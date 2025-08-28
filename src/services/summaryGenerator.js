/**
 * Professional Summary Generator Service
 * Generates tailored professional summaries based on user profile and resume data
 */

class SummaryGenerator {
  /**
   * Generate professional summary based on user data
   * @param {Object} userData - User profile and resume data
   * @param {string} summaryType - Type of summary to generate
   * @param {Object} options - Additional options
   * @returns {string} Generated professional summary
   */
  static generateSummary(userData, summaryType = 'balanced', options = {}) {
    const {
      experienceLevel = 'fresher',
      industry = 'technology',
      targetRole = '',
      keySkills = [],
      achievements = [],
      yearsOfExperience = 0,
      education = {},
      projects = []
    } = userData;

    // Select appropriate template based on experience level and type
    const template = this.getTemplate(experienceLevel, summaryType, industry);
    
    // Generate summary using template
    return this.populateTemplate(template, {
      experienceLevel,
      industry,
      targetRole,
      keySkills,
      achievements,
      yearsOfExperience,
      education,
      projects,
      ...options
    });
  }

  /**
   * Get appropriate template based on criteria
   */
  static getTemplate(experienceLevel, summaryType, industry) {
    const templates = {
      fresher: {
        technical: {
          intro: "Recent {degree} graduate with strong foundation in {primarySkills}",
          body: "Demonstrated expertise through {projectCount} projects including {keyProject}. Proficient in {technicalSkills} with hands-on experience in {frameworks}.",
          closing: "Seeking to leverage technical skills and passion for {industry} in a {targetRole} role."
        },
        balanced: {
          intro: "Motivated {degree} graduate with {yearsOfExperience}+ years of experience in {industry}",
          body: "Strong background in {keySkills} with proven ability to {achievements}. Completed {projectCount} projects demonstrating {coreCompetencies}.",
          closing: "Eager to contribute to innovative projects and grow professionally in a {targetRole} position."
        },
        creative: {
          intro: "Creative and detail-oriented {degree} graduate passionate about {industry}",
          body: "Combines technical proficiency in {keySkills} with creative problem-solving abilities. Portfolio includes {projectCount} projects showcasing {uniqueStrengths}.",
          closing: "Ready to bring fresh perspectives and innovative solutions to a dynamic {targetRole} role."
        }
      },
      experienced: {
        technical: {
          intro: "Experienced {targetRole} with {yearsOfExperience}+ years of expertise in {primarySkills}",
          body: "Proven track record of {achievements} and successful delivery of {projectTypes}. Expert in {technicalSkills} with deep knowledge of {specializations}.",
          closing: "Seeking to leverage extensive experience to drive technical excellence and innovation."
        },
        balanced: {
          intro: "Results-driven {targetRole} with {yearsOfExperience}+ years of progressive experience in {industry}",
          body: "Demonstrated success in {achievements} and leading {teamSize} teams. Strong expertise in {keySkills} with proven ability to {coreCompetencies}.",
          closing: "Committed to delivering exceptional results and driving organizational growth."
        },
        leadership: {
          intro: "Strategic {targetRole} with {yearsOfExperience}+ years of leadership experience in {industry}",
          body: "Successfully {achievements} and managed cross-functional teams of {teamSize}+ members. Expert in {keySkills} with strong focus on {leadershipAreas}.",
          closing: "Passionate about building high-performing teams and driving business transformation."
        }
      },
      senior: {
        executive: {
          intro: "Senior {targetRole} with {yearsOfExperience}+ years of executive leadership in {industry}",
          body: "Proven track record of {achievements} and driving {businessImpact}. Strategic expertise in {keySkills} with deep understanding of {marketAreas}.",
          closing: "Committed to organizational excellence and sustainable business growth."
        },
        technical: {
          intro: "Senior {targetRole} with {yearsOfExperience}+ years of technical leadership and architecture experience",
          body: "Led development of {systemTypes} serving {userScale} users. Expert in {technicalSkills} with proven ability to {technicalAchievements}.",
          closing: "Focused on building scalable solutions and mentoring next-generation technical talent."
        },
        strategic: {
          intro: "Strategic {targetRole} with {yearsOfExperience}+ years of experience driving {businessAreas}",
          body: "Successfully {achievements} and implemented {strategicInitiatives}. Deep expertise in {keySkills} with strong track record of {businessResults}.",
          closing: "Dedicated to creating long-term value and competitive advantage."
        }
      }
    };

    return templates[experienceLevel]?.[summaryType] || templates.fresher.balanced;
  }

  /**
   * Populate template with user data
   */
  static populateTemplate(template, data) {
    const {
      experienceLevel,
      industry,
      targetRole,
      keySkills,
      achievements,
      yearsOfExperience,
      education,
      projects
    } = data;

    // Prepare replacement values
    const replacements = {
      degree: education.degree || 'Computer Science',
      primarySkills: this.formatSkillsList(keySkills.slice(0, 3)),
      technicalSkills: this.formatSkillsList(keySkills.filter(skill => this.isTechnicalSkill(skill))),
      keySkills: this.formatSkillsList(keySkills.slice(0, 4)),
      frameworks: this.formatSkillsList(keySkills.filter(skill => this.isFramework(skill))),
      projectCount: projects.length || 'multiple',
      keyProject: projects[0]?.title || 'key technical project',
      targetRole: targetRole || this.getDefaultRole(industry, experienceLevel),
      industry: industry || 'technology',
      yearsOfExperience: yearsOfExperience || this.getDefaultExperience(experienceLevel),
      achievements: this.formatAchievements(achievements),
      coreCompetencies: this.getCoreCompetencies(keySkills, experienceLevel),
      uniqueStrengths: this.getUniqueStrengths(keySkills, projects),
      projectTypes: this.getProjectTypes(projects),
      specializations: this.getSpecializations(keySkills),
      teamSize: this.getTeamSize(experienceLevel),
      leadershipAreas: this.getLeadershipAreas(keySkills),
      businessImpact: this.getBusinessImpact(achievements),
      marketAreas: this.getMarketAreas(industry),
      systemTypes: this.getSystemTypes(projects),
      userScale: this.getUserScale(experienceLevel),
      technicalAchievements: this.getTechnicalAchievements(achievements),
      businessAreas: this.getBusinessAreas(industry),
      strategicInitiatives: this.getStrategicInitiatives(achievements),
      businessResults: this.getBusinessResults(achievements)
    };

    // Replace placeholders in template
    let summary = `${template.intro}. ${template.body} ${template.closing}`;
    
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      summary = summary.replace(regex, value);
    });

    return this.cleanupSummary(summary);
  }

  /**
   * Helper methods for data processing
   */
  static formatSkillsList(skills) {
    if (!skills || skills.length === 0) return 'various technologies';
    if (skills.length === 1) return skills[0];
    if (skills.length === 2) return skills.join(' and ');
    return `${skills.slice(0, -1).join(', ')}, and ${skills[skills.length - 1]}`;
  }

  static isTechnicalSkill(skill) {
    const technicalKeywords = ['javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes'];
    return technicalKeywords.some(keyword => skill.toLowerCase().includes(keyword));
  }

  static isFramework(skill) {
    const frameworks = ['react', 'angular', 'vue', 'express', 'django', 'spring', 'laravel', 'rails'];
    return frameworks.some(framework => skill.toLowerCase().includes(framework));
  }

  static getDefaultRole(industry, experienceLevel) {
    const roles = {
      technology: {
        fresher: 'Software Developer',
        experienced: 'Senior Software Engineer',
        senior: 'Technical Lead'
      },
      finance: {
        fresher: 'Financial Analyst',
        experienced: 'Senior Financial Analyst',
        senior: 'Finance Manager'
      },
      marketing: {
        fresher: 'Marketing Coordinator',
        experienced: 'Marketing Manager',
        senior: 'Marketing Director'
      }
    };
    return roles[industry]?.[experienceLevel] || 'Professional';
  }

  static getDefaultExperience(experienceLevel) {
    const experience = {
      fresher: '0-1',
      experienced: '3-5',
      senior: '8+'
    };
    return experience[experienceLevel] || '2';
  }

  static formatAchievements(achievements) {
    if (!achievements || achievements.length === 0) {
      return 'delivering high-quality solutions';
    }
    return achievements.slice(0, 2).join(' and ');
  }

  static getCoreCompetencies(skills, experienceLevel) {
    const competencies = {
      fresher: 'problem-solving and rapid learning',
      experienced: 'technical leadership and project delivery',
      senior: 'strategic planning and team development'
    };
    return competencies[experienceLevel] || 'technical excellence';
  }

  static getUniqueStrengths(skills, projects) {
    const strengths = [];
    if (skills.some(s => this.isTechnicalSkill(s))) strengths.push('technical proficiency');
    if (projects.length > 2) strengths.push('project diversity');
    strengths.push('innovative thinking');
    return this.formatSkillsList(strengths);
  }

  static getProjectTypes(projects) {
    if (!projects || projects.length === 0) return 'complex technical projects';
    const types = projects.map(p => p.category || 'web application').slice(0, 2);
    return this.formatSkillsList(types);
  }

  static getSpecializations(skills) {
    const specializations = skills.filter(skill => 
      ['architecture', 'security', 'performance', 'scalability', 'cloud'].some(spec => 
        skill.toLowerCase().includes(spec)
      )
    );
    return specializations.length > 0 ? this.formatSkillsList(specializations) : 'modern development practices';
  }

  static getTeamSize(experienceLevel) {
    const sizes = {
      experienced: '5-10',
      senior: '15-20'
    };
    return sizes[experienceLevel] || '5';
  }

  static getLeadershipAreas(skills) {
    return 'technical mentoring and process improvement';
  }

  static getBusinessImpact(achievements) {
    return achievements.length > 0 ? achievements[0] : 'significant business growth';
  }

  static getMarketAreas(industry) {
    const areas = {
      technology: 'emerging technologies and digital transformation',
      finance: 'financial markets and risk management',
      healthcare: 'healthcare innovation and patient outcomes'
    };
    return areas[industry] || 'industry best practices';
  }

  static getSystemTypes(projects) {
    return projects.length > 0 ? 'enterprise-grade systems' : 'scalable applications';
  }

  static getUserScale(experienceLevel) {
    const scales = {
      experienced: '10K+',
      senior: '100K+'
    };
    return scales[experienceLevel] || '1K+';
  }

  static getTechnicalAchievements(achievements) {
    return 'optimize system performance and reduce technical debt';
  }

  static getBusinessAreas(industry) {
    return `${industry} innovation and market expansion`;
  }

  static getStrategicInitiatives(achievements) {
    return 'digital transformation initiatives';
  }

  static getBusinessResults(achievements) {
    return 'revenue growth and operational efficiency';
  }

  static cleanupSummary(summary) {
    // Remove extra spaces and ensure proper punctuation
    return summary
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/\s+,/g, ',')
      .trim();
  }

  /**
   * Get predefined summary types for different roles
   */
  static getSummaryTypes() {
    return {
      fresher: {
        technical: 'Technical Focus - Emphasizes technical skills and projects',
        balanced: 'Balanced Approach - Mix of technical and soft skills',
        creative: 'Creative Focus - Highlights creativity and innovation'
      },
      experienced: {
        technical: 'Technical Leadership - Focus on technical expertise',
        balanced: 'Professional Growth - Balanced professional summary',
        leadership: 'Leadership Focus - Emphasizes team and project leadership'
      },
      senior: {
        executive: 'Executive Summary - Strategic and business-focused',
        technical: 'Technical Architecture - Senior technical leadership',
        strategic: 'Strategic Vision - Long-term strategic focus'
      }
    };
  }

  /**
   * Generate multiple summary options
   */
  static generateMultipleSummaries(userData, count = 3) {
    const { experienceLevel = 'fresher' } = userData;
    const availableTypes = Object.keys(this.getSummaryTypes()[experienceLevel] || {});
    
    const summaries = [];
    for (let i = 0; i < Math.min(count, availableTypes.length); i++) {
      const type = availableTypes[i];
      summaries.push({
        type,
        title: this.getSummaryTypes()[experienceLevel][type],
        content: this.generateSummary(userData, type)
      });
    }
    
    return summaries;
  }
}

module.exports = SummaryGenerator;