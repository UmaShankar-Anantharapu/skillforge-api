const axios = require('axios');

// Configuration for Ollama LLM service
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';

/**
 * Generate professional summary using AI
 * @param {Object} summaryRequest - Request parameters for summary generation
 * @returns {Object} Generated summary with metadata
 */
async function generateProfessionalSummary(summaryRequest) {
  try {
    const {
      type,
      experienceLevel,
      industry,
      keySkills,
      achievements,
      customPrompt,
      existingExperience,
      existingEducation,
      existingSkills
    } = summaryRequest;

    // Build context from existing resume data
    const context = buildResumeContext({
      experience: existingExperience,
      education: existingEducation,
      skills: existingSkills
    });

    // Generate prompt based on type and parameters
    const prompt = buildSummaryPrompt({
      type,
      experienceLevel,
      industry,
      keySkills,
      achievements,
      customPrompt,
      context
    });

    // Call Ollama API
    const response = await callOllamaAPI(prompt);

    return {
      content: response.content,
      prompt: prompt,
      model: DEFAULT_MODEL,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating professional summary:', error);
    
    // Fallback to template-based summary
    return generateFallbackSummary(summaryRequest);
  }
}

/**
 * Build context from existing resume data
 * @param {Object} resumeData - Existing resume sections
 * @returns {String} Formatted context string
 */
function buildResumeContext({ experience, education, skills }) {
  let context = '';

  // Add experience context
  if (experience && experience.length > 0) {
    context += '\nExisting Experience:\n';
    experience.forEach((exp, index) => {
      context += `${index + 1}. ${exp.position} at ${exp.company}`;
      if (exp.technologies && exp.technologies.length > 0) {
        context += ` (Technologies: ${exp.technologies.join(', ')})`;
      }
      context += '\n';
    });
  }

  // Add education context
  if (education && education.length > 0) {
    context += '\nEducation:\n';
    education.forEach((edu, index) => {
      context += `${index + 1}. ${edu.degree} in ${edu.field || 'N/A'} from ${edu.institution}\n`;
    });
  }

  // Add skills context
  if (skills) {
    if (skills.technical && skills.technical.length > 0) {
      context += '\nTechnical Skills:\n';
      skills.technical.forEach(category => {
        if (category.items && category.items.length > 0) {
          context += `${category.category || 'General'}: ${category.items.join(', ')}\n`;
        }
      });
    }

    if (skills.soft && skills.soft.length > 0) {
      context += `\nSoft Skills: ${skills.soft.join(', ')}\n`;
    }
  }

  return context;
}

/**
 * Build AI prompt for summary generation
 * @param {Object} params - Prompt parameters
 * @returns {String} Complete prompt for AI
 */
function buildSummaryPrompt({
  type,
  experienceLevel,
  industry,
  keySkills,
  achievements,
  customPrompt,
  context
}) {
  let prompt = '';

  // Base instruction
  prompt += 'You are a professional resume writer. Generate a compelling professional summary for a resume. ';
  prompt += 'The summary should be 3-4 sentences, highlight key strengths, and be tailored for the specified role type.\n\n';

  // Role-specific guidance
  const roleGuidance = getRoleSpecificGuidance(type);
  prompt += `Role Type: ${type.charAt(0).toUpperCase() + type.slice(1)} Developer/Professional\n`;
  prompt += `Guidance: ${roleGuidance}\n\n`;

  // Experience level context
  const experienceLevelGuidance = getExperienceLevelGuidance(experienceLevel);
  prompt += `Experience Level: ${experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)}\n`;
  prompt += `Level Guidance: ${experienceLevelGuidance}\n\n`;

  // Industry context
  if (industry) {
    prompt += `Target Industry: ${industry}\n\n`;
  }

  // Key skills
  if (keySkills && keySkills.length > 0) {
    prompt += `Key Skills to Highlight: ${keySkills.join(', ')}\n\n`;
  }

  // Achievements
  if (achievements && achievements.length > 0) {
    prompt += `Key Achievements to Include: ${achievements.join('; ')}\n\n`;
  }

  // Existing resume context
  if (context.trim()) {
    prompt += `Existing Resume Information:${context}\n`;
  }

  // Custom prompt
  if (customPrompt) {
    prompt += `Additional Requirements: ${customPrompt}\n\n`;
  }

  // Final instructions
  prompt += 'Generate a professional summary that:\n';
  prompt += '1. Is 3-4 sentences long\n';
  prompt += '2. Starts with years of experience or expertise level\n';
  prompt += '3. Highlights relevant technical skills and achievements\n';
  prompt += '4. Mentions the target role or industry focus\n';
  prompt += '5. Uses action-oriented language and quantifiable results when possible\n';
  prompt += '6. Is written in third person\n\n';
  prompt += 'Professional Summary:';

  return prompt;
}

/**
 * Get role-specific guidance for summary generation
 * @param {String} type - Role type
 * @returns {String} Role-specific guidance
 */
function getRoleSpecificGuidance(type) {
  const guidance = {
    frontend: 'Focus on UI/UX skills, JavaScript frameworks (React, Angular, Vue), responsive design, and user experience optimization.',
    backend: 'Emphasize server-side technologies, databases, APIs, system architecture, and scalability solutions.',
    fullstack: 'Highlight both frontend and backend capabilities, full project lifecycle experience, and versatility across the tech stack.',
    mobile: 'Focus on mobile development platforms (iOS, Android, React Native, Flutter), app store optimization, and mobile UX.',
    devops: 'Emphasize CI/CD, cloud platforms, infrastructure automation, monitoring, and deployment strategies.',
    data: 'Highlight data analysis, machine learning, statistical modeling, data visualization, and big data technologies.',
    ai_ml: 'Focus on machine learning algorithms, AI frameworks, model deployment, and data science methodologies.',
    qa: 'Emphasize testing methodologies, automation frameworks, quality assurance processes, and bug tracking.',
    ui_ux: 'Focus on user research, design thinking, prototyping tools, usability testing, and design systems.',
    custom: 'Create a balanced summary highlighting technical skills, problem-solving abilities, and professional growth.'
  };

  return guidance[type] || guidance.custom;
}

/**
 * Get experience level guidance
 * @param {String} level - Experience level
 * @returns {String} Level-specific guidance
 */
function getExperienceLevelGuidance(level) {
  const guidance = {
    entry: 'Focus on education, internships, personal projects, eagerness to learn, and foundational skills.',
    junior: 'Highlight 1-2 years of experience, key projects, learning agility, and growing technical competencies.',
    mid: 'Emphasize 3-5 years of experience, project leadership, technical expertise, and problem-solving abilities.',
    senior: 'Focus on 5+ years of experience, mentoring, architecture decisions, and strategic technical contributions.',
    lead: 'Highlight leadership experience, team management, strategic planning, and cross-functional collaboration.'
  };

  return guidance[level] || guidance.entry;
}

/**
 * Call Ollama API for text generation
 * @param {String} prompt - The prompt to send to AI
 * @returns {Object} AI response
 */
async function callOllamaAPI(prompt) {
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: DEFAULT_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 200
      }
    }, {
      timeout: 30000 // 30 second timeout
    });

    if (response.data && response.data.response) {
      return {
        content: response.data.response.trim(),
        model: DEFAULT_MODEL
      };
    } else {
      throw new Error('Invalid response from Ollama API');
    }
  } catch (error) {
    console.error('Ollama API call failed:', error.message);
    throw error;
  }
}

/**
 * Generate fallback summary when AI is unavailable
 * @param {Object} summaryRequest - Request parameters
 * @returns {Object} Fallback summary
 */
function generateFallbackSummary(summaryRequest) {
  const {
    type,
    experienceLevel,
    industry,
    keySkills,
    achievements
  } = summaryRequest;

  // Template-based fallback summaries
  const templates = {
    frontend: {
      entry: 'Passionate Frontend Developer with strong foundation in HTML, CSS, and JavaScript. Experienced in modern frameworks and responsive design principles. Eager to contribute to user-centric web applications and continuously learn new technologies.',
      junior: 'Frontend Developer with 1-2 years of experience building responsive web applications. Proficient in React/Angular and modern CSS frameworks. Demonstrated ability to collaborate with design teams and deliver pixel-perfect user interfaces.',
      mid: 'Experienced Frontend Developer with 3-5 years of expertise in JavaScript frameworks and modern web technologies. Proven track record of optimizing user experiences and implementing scalable frontend architectures.',
      senior: 'Senior Frontend Developer with 5+ years of experience leading frontend initiatives and mentoring junior developers. Expert in performance optimization, accessibility, and modern development practices.',
      lead: 'Frontend Engineering Lead with extensive experience managing development teams and driving technical strategy. Specialized in scalable frontend architectures and cross-functional collaboration.'
    },
    backend: {
      entry: 'Motivated Backend Developer with solid understanding of server-side technologies and database management. Experienced in API development and eager to build scalable, efficient systems.',
      junior: 'Backend Developer with 1-2 years of experience designing and implementing RESTful APIs. Proficient in database optimization and server-side programming languages.',
      mid: 'Experienced Backend Developer with 3-5 years of expertise in system architecture and database design. Proven ability to build scalable microservices and optimize application performance.',
      senior: 'Senior Backend Developer with 5+ years of experience architecting robust server-side solutions. Expert in distributed systems, performance optimization, and technical leadership.',
      lead: 'Backend Engineering Lead with extensive experience in system design and team management. Specialized in scalable architecture patterns and strategic technical decision-making.'
    },
    fullstack: {
      entry: 'Versatile Full Stack Developer with knowledge of both frontend and backend technologies. Passionate about building end-to-end solutions and learning across the entire development stack.',
      junior: 'Full Stack Developer with 1-2 years of experience building complete web applications. Comfortable working with modern frameworks and databases to deliver comprehensive solutions.',
      mid: 'Experienced Full Stack Developer with 3-5 years of expertise across the entire technology stack. Proven ability to lead projects from conception to deployment.',
      senior: 'Senior Full Stack Developer with 5+ years of experience architecting and implementing complex web applications. Expert in both frontend and backend technologies with strong leadership skills.',
      lead: 'Full Stack Engineering Lead with extensive experience managing cross-functional teams and technical strategy. Specialized in end-to-end solution architecture and product development.'
    }
  };

  // Get base template
  let content = templates[type]?.[experienceLevel] || 
                templates.fullstack[experienceLevel] || 
                'Dedicated software professional with strong technical skills and passion for building innovative solutions. Committed to continuous learning and delivering high-quality results.';

  // Customize with provided skills and industry
  if (keySkills && keySkills.length > 0) {
    content = content.replace('modern frameworks', keySkills.slice(0, 3).join(', '));
    content = content.replace('modern web technologies', keySkills.slice(0, 3).join(', '));
  }

  if (industry) {
    content += ` Focused on ${industry} industry applications and solutions.`;
  }

  return {
    content: content,
    prompt: 'Fallback template-based summary',
    model: 'template-fallback',
    generatedAt: new Date()
  };
}

/**
 * Validate resume data completeness
 * @param {Object} resume - Resume object
 * @returns {Object} Validation result with completion percentage and missing fields
 */
function validateResumeCompleteness(resume) {
  const requiredFields = {
    personalInfo: ['fullName', 'email'],
    professionalSummary: ['content'],
    experience: 'array_not_empty',
    education: 'array_not_empty',
    skills: 'object_with_content'
  };

  const validation = {
    isComplete: true,
    completionPercentage: 0,
    missingFields: [],
    warnings: []
  };

  let completedSections = 0;
  const totalSections = Object.keys(requiredFields).length;

  // Check each required section
  Object.entries(requiredFields).forEach(([section, requirements]) => {
    if (!resume[section]) {
      validation.missingFields.push(section);
      validation.isComplete = false;
      return;
    }

    if (Array.isArray(requirements)) {
      // Check required fields in object
      const missing = requirements.filter(field => !resume[section][field]);
      if (missing.length > 0) {
        validation.missingFields.push(...missing.map(field => `${section}.${field}`));
        validation.isComplete = false;
      } else {
        completedSections++;
      }
    } else if (requirements === 'array_not_empty') {
      // Check if array has content
      if (!Array.isArray(resume[section]) || resume[section].length === 0) {
        validation.missingFields.push(section);
        validation.isComplete = false;
      } else {
        completedSections++;
      }
    } else if (requirements === 'object_with_content') {
      // Check if object has meaningful content
      const hasContent = resume[section].technical?.length > 0 || 
                        resume[section].soft?.length > 0 || 
                        resume[section].languages?.length > 0;
      if (!hasContent) {
        validation.missingFields.push(section);
        validation.isComplete = false;
      } else {
        completedSections++;
      }
    }
  });

  validation.completionPercentage = Math.round((completedSections / totalSections) * 100);

  // Add warnings for optional but recommended fields
  if (!resume.projects || resume.projects.length === 0) {
    validation.warnings.push('Consider adding projects to strengthen your resume');
  }

  if (!resume.certifications || resume.certifications.length === 0) {
    validation.warnings.push('Adding relevant certifications can enhance your profile');
  }

  return validation;
}

/**
 * Calculate resume score based on various factors
 * @param {Object} resume - Resume object
 * @returns {Object} Score breakdown and recommendations
 */
function calculateResumeScore(resume) {
  const scores = {
    completeness: 0,
    content_quality: 0,
    ats_optimization: 0,
    overall: 0
  };

  const recommendations = [];

  // Completeness score (40% of total)
  const validation = validateResumeCompleteness(resume);
  scores.completeness = validation.completionPercentage;

  // Content quality score (35% of total)
  let contentScore = 0;
  
  // Professional summary quality
  if (resume.professionalSummary?.content) {
    const summaryLength = resume.professionalSummary.content.length;
    if (summaryLength >= 200 && summaryLength <= 400) {
      contentScore += 25;
    } else if (summaryLength >= 100) {
      contentScore += 15;
      recommendations.push('Professional summary should be 200-400 characters for optimal impact');
    }
  }

  // Experience descriptions
  if (resume.experience?.length > 0) {
    const hasDescriptions = resume.experience.every(exp => exp.description && exp.description.length > 50);
    if (hasDescriptions) {
      contentScore += 25;
    } else {
      contentScore += 10;
      recommendations.push('Add detailed descriptions for all work experiences');
    }
  }

  // Skills organization
  if (resume.skills?.technical?.length > 0) {
    contentScore += 25;
  } else {
    recommendations.push('Add technical skills relevant to your target role');
  }

  // Projects inclusion
  if (resume.projects?.length > 0) {
    contentScore += 25;
  } else {
    recommendations.push('Include relevant projects to showcase your abilities');
  }

  scores.content_quality = contentScore;

  // ATS optimization score (25% of total)
  let atsScore = 0;
  
  // Standard section names
  const standardSections = ['experience', 'education', 'skills'];
  const hasStandardSections = standardSections.every(section => 
    resume.configuration?.visibleSections?.includes(section)
  );
  if (hasStandardSections) {
    atsScore += 40;
  }

  // Contact information completeness
  if (resume.personalInfo?.email && resume.personalInfo?.phone) {
    atsScore += 30;
  }

  // Skills keywords
  const totalSkills = (resume.skills?.technical?.reduce((acc, cat) => acc + cat.items.length, 0) || 0) +
                     (resume.skills?.soft?.length || 0);
  if (totalSkills >= 10) {
    atsScore += 30;
  } else if (totalSkills >= 5) {
    atsScore += 20;
    recommendations.push('Add more relevant skills to improve ATS compatibility');
  }

  scores.ats_optimization = atsScore;

  // Calculate overall score
  scores.overall = Math.round(
    (scores.completeness * 0.4) + 
    (scores.content_quality * 0.35) + 
    (scores.ats_optimization * 0.25)
  );

  return {
    scores,
    recommendations,
    grade: getScoreGrade(scores.overall)
  };
}

/**
 * Get letter grade based on score
 * @param {Number} score - Overall score (0-100)
 * @returns {String} Letter grade
 */
function getScoreGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 65) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

module.exports = {
  generateProfessionalSummary,
  validateResumeCompleteness,
  calculateResumeScore,
  buildResumeContext,
  buildSummaryPrompt
};