const Groq = require('groq-sdk');
const config = require('../config');
const logger = require('../utils/logger');

class GroqService {
  constructor() {
    this.client = new Groq({ apiKey: config.groq.apiKey });
    this.fallbackModels = [
      config.groq.model,
      ...(config.groq.fallbackModels || []),
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768'
    ]
      .filter(Boolean)
      .filter((model, index, array) => array.indexOf(model) === index);

    this.activeModelName = this.fallbackModels[0];
    logger.info(`Groq service initialized with model: ${this.activeModelName}`);
  }

  async analyzeText(text) {
    try {
      logger.info('Starting text analysis with Groq AI', { textLength: text.length });

      const prompt = `
        You are an AI research assistant.

        Analyze the following text and return a structured JSON response.

        Instructions:
        - Write in a clear, academic tone
        - Be concise but informative
        - Do not include any text outside the JSON
        - Ensure the output is valid JSON (no trailing commas, no comments)

        Return the result in this exact format:

        {
          "summary": "A concise academic-style summary (2-3 sentences)",
          "keyPoints": [
            "Key contribution or insight 1",
            "Key contribution or insight 2",
            "Key contribution or insight 3"
          ],
          "limitations": [
            "Limitation or assumption 1",
            "Limitation or weakness 2"
          ],
          "futureWork": [
            "Potential future research direction 1",
            "Potential improvement or extension 2"
          ]
        }

        Text to analyze:
        ${text}
      `;

      const analysisText = await this.generateWithFallback(prompt);
      logger.info('Groq API call successful', { responseLength: analysisText.length });
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      logger.error('Error in Groq text analysis', {
        error: error.message,
        stack: error.stack,
        textLength: text.length
      });
      throw new Error(`Failed to analyze text: ${error.message}`);
    }
  }

  async combineAnalyses(analyses) {
    try {
      logger.info('Starting combined analyses generation', {
        analysesCount: analyses.length
      });

      const prompt = `
        You are an AI research assistant.

        Given multiple research paper analyses, generate:

        1. overallSummary:
        - combined understanding of all papers

        2. commonThemes:
        - ideas shared across papers

        3. differences:
        - how the papers differ in approach or conclusions

        4. researchGaps:
        - missing areas or open problems

        Be concise and analytical.

        Return only valid JSON.

        Analyses:
        ${JSON.stringify(analyses)}
      `;

      const combinedText = await this.generateWithFallback(prompt);
      return this.parseCombinedAnalysesResponse(combinedText);
    } catch (error) {
      logger.error('Error combining analyses', {
        error: error.message,
        stack: error.stack,
        analysesCount: analyses.length
      });
      throw new Error(`Failed to combine analyses: ${error.message}`);
    }
  }

  async generateAcademicEmail({ researchContext, professorName, researchArea }) {
    try {
      logger.info('Starting academic email generation with Groq AI', {
        researchContextLength: researchContext.length,
        hasProfessorName: Boolean(professorName),
        hasResearchArea: Boolean(researchArea)
      });

      const prompt = `
        You are an academic writing assistant.

        Generate a professional email for a student contacting a professor.
        Tone requirements:
        - formal
        - concise
        - academic
        - not overly enthusiastic
        - not robotic

        Output requirements:
        - Return valid JSON only
        - Do not include markdown, code fences, or extra text
        - JSON format must be:
        {
          "subject": "A concise and specific subject line",
          "email": "Full email body with paragraph breaks"
        }

        The email body must include:
        1) Greeting
        2) Introduction with student background
        3) Clear reference to the provided research context (very important)
        4) Why this professor's work is relevant
        5) Polite request for supervision or discussion
        6) Professional closing with sign-off

        Context:
        - Professor Name: ${professorName || 'Not provided'}
        - Research Area: ${researchArea || 'Not provided'}
        - Research Context: ${researchContext}
      `;

      const responseText = await this.generateWithFallback(prompt);
      logger.info('Academic email generation completed', { responseLength: responseText.length });

      return this.parseEmailResponse(responseText);
    } catch (error) {
      logger.error('Error in Groq academic email generation', {
        error: error.message,
        stack: error.stack,
        researchContextLength: researchContext.length
      });
      throw new Error(`Failed to generate email: ${error.message}`);
    }
  }

  async generateWithFallback(prompt) {
    let lastError = null;

    for (const modelName of this.fallbackModels) {
      try {
        if (this.activeModelName !== modelName) {
          this.activeModelName = modelName;
          logger.warn('Switched Groq model', { model: modelName });
        }

        const completion = await this.client.chat.completions.create({
          model: modelName,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'You are a precise analysis assistant. Always return clean JSON only.'
            },
            { role: 'user', content: prompt }
          ]
        });

        return completion?.choices?.[0]?.message?.content || '';
      } catch (error) {
        lastError = error;
        logger.warn('Groq model request failed', {
          model: modelName,
          error: error.message
        });
      }
    }

    throw lastError || new Error('No available Groq model could process the request.');
  }

  parseAnalysisResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      const analysis = JSON.parse(jsonText);

      if (!analysis.summary && !analysis.keyPoints && !analysis.limitations) {
        throw new Error('Invalid response structure');
      }

      return analysis;
    } catch (parseError) {
      logger.warn('Failed to parse JSON response, returning raw analysis', {
        parseError: parseError.message,
        responseText: responseText.substring(0, 200) + '...'
      });
      return { rawAnalysis: responseText };
    }
  }

  parseCombinedAnalysesResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      const combined = JSON.parse(jsonText);

      if (
        !combined.overallSummary ||
        !Array.isArray(combined.commonThemes) ||
        !Array.isArray(combined.differences) ||
        !Array.isArray(combined.researchGaps)
      ) {
        throw new Error('Invalid combined analyses response structure');
      }

      return combined;
    } catch (parseError) {
      logger.warn('Failed to parse combined analyses JSON response', {
        parseError: parseError.message,
        responseText: responseText.substring(0, 200) + '...'
      });
      throw new Error('Failed to parse combined analyses response');
    }
  }

  parseEmailResponse(responseText) {
    const escapeControlCharsInJsonStrings = (text) => {
      let result = '';
      let inString = false;
      let escaping = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (escaping) {
          result += char;
          escaping = false;
          continue;
        }

        if (char === '\\') {
          result += char;
          escaping = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          result += char;
          continue;
        }

        if (inString && char === '\n') {
          result += '\\n';
          continue;
        }

        if (inString && char === '\r') {
          result += '\\r';
          continue;
        }

        if (inString && char === '\t') {
          result += '\\t';
          continue;
        }

        result += char;
      }

      return result;
    };

    const normalizeFieldText = (value) => value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .trim();

    try {
      const withoutCodeFences = responseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const jsonMatch = withoutCodeFences.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : withoutCodeFences;

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (firstError) {
        const sanitizedJsonText = escapeControlCharsInJsonStrings(jsonText);
        parsed = JSON.parse(sanitizedJsonText);
      }

      if (typeof parsed.subject !== 'string' || typeof parsed.email !== 'string') {
        throw new Error('Invalid email response structure');
      }

      return {
        subject: normalizeFieldText(parsed.subject),
        email: normalizeFieldText(parsed.email)
      };
    } catch (parseError) {
      logger.warn('Failed to parse academic email JSON response', {
        parseError: parseError.message,
        responseText: responseText.substring(0, 300) + '...'
      });
      throw new Error('Failed to parse generated email response');
    }
  }

  async healthCheck() {
    try {
      await this.generateWithFallback('Reply with JSON: {"ok": true}');
      return true;
    } catch (error) {
      logger.error('Groq service health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new GroqService();
