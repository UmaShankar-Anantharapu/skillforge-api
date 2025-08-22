const fs = require('fs').promises;
const path = require('path');
const { chat, extractJSON } = require('./llmClient');

/**
 * Extract text content from a resume file
 * @param {string} filePath Path to the resume file
 * @param {string} fileType Type of file (pdf, doc, docx)
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromResume(filePath, fileType) {
  try {
    // For a production implementation, you would use proper libraries:
    // - pdf-parse for PDF files
    // - mammoth or docx for DOC/DOCX files
    
    // Read the file as a buffer
    const fileBuffer = await fs.readFile(filePath);
    
    // Use proper extraction libraries when available
    if (fileType === 'pdf') {
      try {
        // Try to use pdf-parse if available
        const pdfParse = require('pdf-parse');
        const result = await pdfParse(fileBuffer);
        return result.text;
      } catch (err) {
        console.warn('pdf-parse not available, using placeholder text:', err.message);
        // Fallback to placeholder if library not available
        return `Sample extracted text from PDF file: ${path.basename(filePath)}`;
      }
    } else if (fileType === 'doc' || fileType === 'docx') {
      try {
        // Try to use mammoth if available for docx
        if (fileType === 'docx') {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({buffer: fileBuffer});
          return result.value;
        } else {
          // No good library for .doc files in Node.js
          return `Sample extracted text from ${fileType.toUpperCase()} file: ${path.basename(filePath)}`;
        }
      } catch (err) {
        console.warn('Document extraction library not available, using placeholder text:', err.message);
        // Fallback to placeholder if library not available
        return `Sample extracted text from ${fileType.toUpperCase()} file: ${path.basename(filePath)}`;
      }
    } else {
      throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text from resume:', error);
    throw new Error(`Failed to extract text from resume: ${error.message}`);
  }
}

/**
 * Generate a structured prompt for the LLM to extract onboarding fields
 * @param {string} resumeText Extracted text from the resume
 * @returns {string} Structured prompt for the LLM
 */
function generateStructuredPrompt(resumeText) {
  return [
    {
      role: 'system',
      content: `You are an expert resume analyzer. Your task is to extract relevant information from the provided resume text and format it according to specific onboarding fields. 

Analyze the resume carefully and extract the following information:

1. Personal Information:
   - Full Name
   - Email
   - Phone Number
   - Job Title (current or most recent)
   - Company (current or most recent)
   - Industry
   - Years of Experience (categorize as: '0-2', '3-5', '6-10', '10+')

2. Education and Background:
   - Education Level (categorize as: 'High School', 'Bachelor\'s', 'Master\'s', 'PhD', 'Professional Certification', 'Self-taught')
   - Certifications (list all relevant professional certifications)
   - Team Role (categorize as: 'Individual contributor', 'Team lead', 'Manager', 'Senior manager', 'Executive', 'Student')

3. Skills Assessment:
   - Primary Skill Category (main area of expertise)
   - Skills (list all technical and professional skills mentioned)
   - Priority Skills (identify top 3 skills based on prominence in resume)
   - Current Skill Levels (for each skill, categorize level as: 'Beginner', 'Intermediate', 'Advanced', 'Expert')

4. User Type Classification:
   - User Type (categorize as: 'fresher', 'experienced', 'hobbyist' based on experience and skill levels)

Return your analysis as a JSON object with the following structure:

{
  "personalInfo": {
    "fullName": "string",
    "email": "string",
    "phoneNumber": "string",
    "jobTitle": "string",
    "company": "string",
    "industry": "string",
    "yearsExperience": "string" // One of: '0-2', '3-5', '6-10', '10+'
  },
  "background": {
    "educationLevel": "string", // One of: 'High School', 'Bachelor\'s', 'Master\'s', 'PhD', 'Professional Certification', 'Self-taught'
    "certifications": ["string"],
    "teamRole": "string" // One of: 'Individual contributor', 'Team lead', 'Manager', 'Senior manager', 'Executive', 'Student'
  },
  "skillsAssessment": {
    "primarySkillCategory": "string",
    "skills": ["string"],
    "prioritySkills": ["string"], // Top 3 skills
    "currentSkillLevels": [
      {
        "skill": "string",
        "level": "string" // One of: 'Beginner', 'Intermediate', 'Advanced', 'Expert'
      }
    ]
  },
  "userType": "string" // One of: 'fresher', 'experienced', 'hobbyist'
}

If you cannot determine a value with confidence, use null or an empty array as appropriate. Do not include any explanations or notes in your response, only the JSON object.`
    },
    {
      role: 'user',
      content: `Here is the resume text to analyze:\n\n${resumeText}`
    }
  ];
}

/**
 * Process a resume file and extract structured information using Ollama LLM
 * @param {string} filePath Path to the resume file
 * @param {string} fileType Type of file (pdf, doc, docx)
 * @returns {Promise<Object>} Structured information extracted from the resume
 */
async function processResume(filePath, fileType) {
  try {
    // Extract text from resume
    const resumeText = await extractTextFromResume(filePath, fileType);
    
    // Generate structured prompt for LLM
    const messages = generateStructuredPrompt(resumeText);
    
    try {
      // Send to Ollama LLM for processing
      const llmResponse = await chat(messages);
      
      // Extract and parse JSON from LLM response
      const extractedData = extractJSON(llmResponse);
      
      if (!extractedData) {
        console.error('Failed to extract JSON from LLM response');
        console.log('LLM response:', llmResponse);
        throw new Error('Failed to parse resume data from LLM response');
      }
      
      return extractedData;
    } catch (llmError) {
      // Check if this is an Ollama connection error
      if (llmError.message.includes('Ollama service is not running')) {
        throw new Error('Resume analysis requires Ollama service which is currently unavailable. Please try the manual input method instead.');
      }
      throw llmError;
    }
  } catch (error) {
    console.error('Error processing resume:', error);
    throw new Error(`Failed to process resume: ${error.message}`);
  }
}

/**
 * Generate draft onboarding data for manual start option
 * @returns {Promise<Object>} Draft onboarding data
 */
async function generateDraftOnboardingData() {
  return {
    personalInfo: {
      fullName: '',
      email: '',
      phoneNumber: '',
      jobTitle: '',
      company: '',
      industry: '',
      yearsExperience: '0-2'
    },
    background: {
      educationLevel: 'Bachelor\'s',
      certifications: [],
      teamRole: 'Individual contributor'
    },
    skillsAssessment: {
      primarySkillCategory: '',
      skills: [],
      prioritySkills: [],
      currentSkillLevels: []
    },
    userType: 'fresher'
  };
}

module.exports = {
  processResume,
  generateDraftOnboardingData
};