const express = require('express');
const { body, validationResult, query } = require('express-validator');
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const UserProfile = require('../models/UserProfile');
const { generateSkillSuggestions } = require('../services/skillSuggestionService');
const { generateRoadmapWithLLM } = require('../services/roadmapLlmService');
const { extractJSON } = require('../services/llmClient');


const router = express.Router();

// Placeholder for generateTrendingRoadmaps - to be properly implemented or imported
require('dotenv').config();
const ollamaBaseUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const ollamaModel = 'phi3:mini';

async function generatePersonalizedRoadmaps(userId, userSkills = [], userGoals = []) {
  console.log('Generating personalized roadmaps with Ollama for user:', userId);

  try {
    const skillsContext = userSkills.length > 0 ? `Current skills: ${userSkills.join(', ')}` : 'No current skills specified';
    const goalsContext = userGoals.length > 0 ? `Career goals: ${userGoals.join(', ')}` : 'General career advancement';
    
    const prompt = `Generate 3 personalized technology roadmaps based on the user's profile. ${skillsContext}. ${goalsContext}. Each roadmap should include a title, a brief description (1-2 sentences), and 3-5 key skills or topics. Format the output as a JSON array of objects, like this: 
    [
      {
        "title": "AI/ML Engineer Roadmap",
        "description": "Master artificial intelligence and machine learning technologies.",
        "skills": ["Python", "TensorFlow", "PyTorch", "Data Science", "Statistics"]
      },
      {
        "title": "Cloud DevOps Engineer",
        "description": "Learn cloud infrastructure and DevOps practices.",
        "skills": ["AWS", "Docker", "Kubernetes", "CI/CD", "Terraform"]
      }
    ]
    Focus on roadmaps that build upon the user's existing skills and align with their career goals. Include diverse technology areas and progressive skill development paths.
    `;

    const response = await axios.post(`${ollamaBaseUrl}/api/generate`, {
      model: ollamaModel,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9
      }
    });

    const generatedText = response.data.response;
    console.log('Raw Ollama response for personalized roadmaps:', generatedText.substring(0, 500) + '...');

    // Extract JSON from the response
    const roadmapsData = extractJSON(generatedText);
    
    if (!roadmapsData || !Array.isArray(roadmapsData)) {
      console.error('Invalid roadmaps data structure:', roadmapsData);
      return { success: false, data: { roadmaps: [] }, error: 'Invalid data structure' };
    }

    // Validate and clean the roadmaps data
    const validRoadmaps = roadmapsData.filter(roadmap => 
      roadmap.title && 
      roadmap.description && 
      roadmap.skills && 
      Array.isArray(roadmap.skills) && 
      roadmap.skills.length > 0
    ).map((roadmap, index) => ({
      id: `personalized-${userId}-${index + 1}`,
      title: roadmap.title,
      description: roadmap.description,
      skills: roadmap.skills,
      estimatedDuration: roadmap.estimatedDuration || '4-6 months',
      difficulty: roadmap.difficulty || 'Intermediate',
      matchScore: Math.floor(Math.random() * 30) + 70 // 70-99% match score
    }));

    console.log(`Generated ${validRoadmaps.length} valid personalized roadmaps`);

    return { success: true, data: { roadmaps: validRoadmaps } };
  } catch (error) {
    console.error('Error generating personalized roadmaps with Ollama:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection to Ollama refused. Is the Ollama server running at', ollamaBaseUrl, '?');
    } else if (error.response) {
      console.error('Ollama API responded with an error:', error.response.status, error.response.data);
    }
    return { success: false, data: { roadmaps: [] }, error: error.message };
  }
}

async function generateTrendingRoadmaps() {

  try {
    const prompt = `Generate a list of 3 trending technology roadmaps. Each roadmap should include a title, a brief description (1-2 sentences), and 3-5 key skills or topics. Format the output as a JSON array of objects, like this: 
    [
      {
        "title": "Roadmap Title 1",
        "description": "Description 1",
        "skills": ["Skill A", "Skill B", "Skill C"]
      },
      {
        "title": "Roadmap Title 2",
        "description": "Description 2",
        "skills": ["Skill X", "Skill Y", "Skill Z"]
      }
    ]
    Focus on current trending technologies like AI/ML, Cloud Computing, DevOps, Web3, Cybersecurity, Mobile Development, Data Science, etc. Include diverse technology areas to provide comprehensive coverage.
    `;

    const response = await axios.post(`${ollamaBaseUrl}/api/generate`, {
      model: ollamaModel,
      prompt: prompt,
      stream: false,
      options: {
        timeout: 30000 // 30 second timeout
      }
    });

    const generatedContent = response.data.response;


    // Use the improved extractJSON function from llmClient
    const roadmaps = extractJSON(generatedContent);
    
    if (!roadmaps || !Array.isArray(roadmaps) || roadmaps.length === 0) {
      console.error('Failed to extract valid roadmaps array from Ollama response');
      return { success: false, data: { roadmaps: [] }, error: 'Failed to parse LLM response' };
    }
    
    // Validate that each roadmap has the required properties
    const validRoadmaps = roadmaps.filter(item => 
      typeof item === 'object' && 
      item !== null && 
      'title' in item && 
      'description' in item && 
      'skills' in item
    );
    
    if (validRoadmaps.length === 0) {
      console.error('No valid roadmaps found after filtering');
      return { success: false, data: { roadmaps: [] }, error: 'No valid roadmaps in response' };
    }
    


    return { success: true, data: { roadmaps: validRoadmaps } };
  } catch (error) {
    console.error('Error generating trending roadmaps with Ollama:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection to Ollama refused. Is the Ollama server running at', ollamaBaseUrl, '?');
    } else if (error.response) {
      console.error('Ollama API responded with an error:', error.response.status, error.response.data);
    }
    return { success: false, data: { roadmaps: [] }, error: error.message };
  }
}









// Trending roadmaps endpoint - simplified version with fallback
router.get('/trending-roadmaps', async (req, res) => {
  
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 25;
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    
    // First try the generateTrendingRoadmaps function
    const result = await generateTrendingRoadmaps();
    
    if (result.success && result.data.roadmaps && result.data.roadmaps.length > 0) {
      // Apply pagination to the results
      const paginatedRoadmaps = result.data.roadmaps.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedRoadmaps,
        count: paginatedRoadmaps.length,
        totalCount: result.data.roadmaps.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(result.data.roadmaps.length / pageSize),
        message: 'Successfully retrieved trending roadmaps'
      });
    } else {

      // Fallback to hardcoded roadmaps if Ollama fails
      const allFallbackRoadmaps = [
        {
          id: 'web-dev-2024',
          title: 'Full Stack Web Development 2024',
          description: 'Complete roadmap for modern web development including frontend, backend, and deployment.',
          skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Docker'],
          estimatedDuration: '6-8 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'ai-ml-roadmap',
          title: 'AI & Machine Learning Engineer',
          description: 'Comprehensive path to becoming an AI/ML engineer with practical projects.',
          skills: ['Python', 'TensorFlow', 'PyTorch', 'Statistics', 'Deep Learning'],
          estimatedDuration: '8-12 months',
          difficulty: 'Advanced'
        },
        {
          id: 'devops-2024',
          title: 'DevOps Engineer Roadmap',
          description: 'Master DevOps practices, tools, and cloud technologies.',
          skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform'],
          estimatedDuration: '4-6 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'mobile-dev-2024',
          title: 'Mobile App Development',
          description: 'Build cross-platform mobile applications using modern frameworks.',
          skills: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Firebase'],
          estimatedDuration: '5-7 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'data-science-2024',
          title: 'Data Science & Analytics',
          description: 'Master data analysis, visualization, and machine learning techniques.',
          skills: ['Python', 'R', 'SQL', 'Pandas', 'Matplotlib'],
          estimatedDuration: '6-9 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'cybersecurity-2024',
          title: 'Cybersecurity Specialist',
          description: 'Learn ethical hacking, security analysis, and threat detection.',
          skills: ['Network Security', 'Penetration Testing', 'CISSP', 'Wireshark', 'Kali Linux'],
          estimatedDuration: '7-10 months',
          difficulty: 'Advanced'
        },
        {
          id: 'cloud-architect-2024',
          title: 'Cloud Solutions Architect',
          description: 'Design and implement scalable cloud infrastructure solutions.',
          skills: ['AWS', 'Azure', 'GCP', 'Terraform', 'CloudFormation'],
          estimatedDuration: '6-8 months',
          difficulty: 'Advanced'
        },
        {
          id: 'blockchain-2024',
          title: 'Blockchain Developer',
          description: 'Build decentralized applications and smart contracts.',
          skills: ['Solidity', 'Web3.js', 'Ethereum', 'Smart Contracts', 'DeFi'],
          estimatedDuration: '5-8 months',
          difficulty: 'Advanced'
        },
        {
          id: 'ui-ux-2024',
          title: 'UI/UX Designer',
          description: 'Create user-centered designs and intuitive interfaces.',
          skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Design Systems'],
          estimatedDuration: '4-6 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'game-dev-2024',
          title: 'Game Development',
          description: 'Create engaging games using modern game engines and frameworks.',
          skills: ['Unity', 'Unreal Engine', 'C#', 'C++', 'Game Design'],
          estimatedDuration: '8-12 months',
          difficulty: 'Advanced'
        },
        {
          id: 'backend-api-2024',
          title: 'Backend API Development',
          description: 'Build robust and scalable backend services and APIs.',
          skills: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'GraphQL'],
          estimatedDuration: '4-6 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'frontend-react-2024',
          title: 'Frontend React Specialist',
          description: 'Master modern React development with advanced patterns.',
          skills: ['React', 'TypeScript', 'Next.js', 'Redux', 'Testing Library'],
          estimatedDuration: '4-5 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'python-automation-2024',
          title: 'Python Automation Engineer',
          description: 'Automate workflows and build efficient Python applications.',
          skills: ['Python', 'Selenium', 'Pandas', 'FastAPI', 'Pytest'],
          estimatedDuration: '3-5 months',
          difficulty: 'Beginner'
        },
        {
          id: 'database-admin-2024',
          title: 'Database Administrator',
          description: 'Manage and optimize database systems for performance and reliability.',
          skills: ['PostgreSQL', 'MySQL', 'MongoDB', 'Database Design', 'Performance Tuning'],
          estimatedDuration: '5-7 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'microservices-2024',
          title: 'Microservices Architecture',
          description: 'Design and implement distributed microservices systems.',
          skills: ['Docker', 'Kubernetes', 'API Gateway', 'Service Mesh', 'Event Sourcing'],
          estimatedDuration: '6-8 months',
          difficulty: 'Advanced'
        },
        {
          id: 'iot-developer-2024',
          title: 'IoT Developer',
          description: 'Build connected devices and IoT solutions.',
          skills: ['Arduino', 'Raspberry Pi', 'MQTT', 'Edge Computing', 'Sensor Integration'],
          estimatedDuration: '5-7 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'qa-automation-2024',
          title: 'QA Automation Engineer',
          description: 'Implement automated testing strategies and frameworks.',
          skills: ['Selenium', 'Cypress', 'Jest', 'API Testing', 'CI/CD Testing'],
          estimatedDuration: '4-6 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'product-manager-2024',
          title: 'Technical Product Manager',
          description: 'Bridge technology and business to deliver successful products.',
          skills: ['Product Strategy', 'Agile', 'Data Analysis', 'User Research', 'Roadmapping'],
          estimatedDuration: '3-5 months',
          difficulty: 'Beginner'
        },
        {
          id: 'ar-vr-2024',
          title: 'AR/VR Developer',
          description: 'Create immersive augmented and virtual reality experiences.',
          skills: ['Unity', 'ARKit', 'ARCore', '3D Modeling', 'Spatial Computing'],
          estimatedDuration: '7-10 months',
          difficulty: 'Advanced'
        },
        {
          id: 'site-reliability-2024',
          title: 'Site Reliability Engineer',
          description: 'Ensure system reliability, scalability, and performance.',
          skills: ['Monitoring', 'Incident Response', 'Automation', 'Linux', 'Observability'],
          estimatedDuration: '6-8 months',
          difficulty: 'Advanced'
        },
        {
          id: 'content-creator-2024',
          title: 'Technical Content Creator',
          description: 'Create engaging technical content and educational materials.',
          skills: ['Technical Writing', 'Video Production', 'SEO', 'Social Media', 'Community Building'],
          estimatedDuration: '3-4 months',
          difficulty: 'Beginner'
        },
        {
          id: 'salesforce-2024',
          title: 'Salesforce Developer',
          description: 'Build custom solutions on the Salesforce platform.',
          skills: ['Apex', 'Lightning Components', 'SOQL', 'Salesforce Admin', 'Integration'],
          estimatedDuration: '4-6 months',
          difficulty: 'Intermediate'
        },
        {
          id: 'low-code-2024',
          title: 'Low-Code/No-Code Developer',
          description: 'Build applications using visual development platforms.',
          skills: ['Power Platform', 'Bubble', 'Zapier', 'Airtable', 'Workflow Automation'],
          estimatedDuration: '2-4 months',
          difficulty: 'Beginner'
        },
        {
          id: 'edge-computing-2024',
          title: 'Edge Computing Specialist',
          description: 'Develop solutions for distributed edge computing environments.',
          skills: ['Edge AI', 'CDN', 'Distributed Systems', 'Real-time Processing', '5G'],
          estimatedDuration: '6-9 months',
          difficulty: 'Advanced'
        },
        {
          id: 'quantum-computing-2024',
          title: 'Quantum Computing Developer',
          description: 'Explore quantum algorithms and quantum software development.',
          skills: ['Qiskit', 'Quantum Algorithms', 'Linear Algebra', 'Python', 'Quantum Physics'],
          estimatedDuration: '9-12 months',
          difficulty: 'Advanced'
        }
      ];
      
      // Apply pagination to fallback roadmaps
      const paginatedFallbackRoadmaps = allFallbackRoadmaps.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedFallbackRoadmaps,
        count: paginatedFallbackRoadmaps.length,
        totalCount: allFallbackRoadmaps.length,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(allFallbackRoadmaps.length / pageSize),
        message: 'Successfully retrieved trending roadmaps (fallback)'
      });
    }
  } catch (error) {
    console.error('Error in trending roadmaps endpoint:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Final fallback - return minimal data
    const minimalRoadmaps = [
      {
        id: 'basic-web',
        title: 'Basic Web Development',
        description: 'Start your web development journey.',
        skills: ['HTML', 'CSS', 'JavaScript'],
        estimatedDuration: '2-3 months',
        difficulty: 'Beginner'
      }
    ];
    
    res.json({
      success: true,
      data: minimalRoadmaps,
      count: minimalRoadmaps.length,
      message: 'Retrieved basic roadmaps (error fallback)'
    });
  }
});















// Personalized roadmaps endpoint
router.get('/personalized-roadmaps', async (req, res) => {
  try {
    const { userId, skills, goals, page, pageSize } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Extract pagination parameters
    const pageNum = parseInt(page) || 0;
    const pageSizeNum = parseInt(pageSize) || 25;
    const startIndex = pageNum * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    
    // Parse skills and goals from query parameters
    const userSkills = skills ? skills.split(',').map(skill => skill.trim()) : [];
    const userGoals = goals ? goals.split(',').map(goal => goal.trim()) : [];
    
    // Try to generate personalized roadmaps using Ollama
    const result = await generatePersonalizedRoadmaps(userId, userSkills, userGoals);
    
    if (result.success && result.data.roadmaps && result.data.roadmaps.length > 0) {
      // Apply pagination to the results
      const paginatedRoadmaps = result.data.roadmaps.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedRoadmaps,
        count: paginatedRoadmaps.length,
        totalCount: result.data.roadmaps.length,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(result.data.roadmaps.length / pageSizeNum),
        message: 'Successfully retrieved personalized roadmaps'
      });
    } else {
      // Fallback to mock data if Ollama fails
       const mockRoadmaps = [
         {
           id: 'ai-ml-roadmap',
           title: 'AI & Machine Learning Mastery',
           description: 'Complete roadmap to become proficient in AI and ML technologies',
           skills: ['Python', 'TensorFlow', 'PyTorch', 'Data Science'],
           estimatedDuration: '6 months',
           difficulty: 'Advanced',
           matchScore: 85
         },
         {
           id: 'fullstack-dev',
           title: 'Full Stack Development',
           description: 'End-to-end web development with modern technologies',
           skills: ['React', 'Node.js', 'MongoDB', 'Express'],
           estimatedDuration: '4 months',
           difficulty: 'Intermediate',
           matchScore: 78
         },
         {
           id: 'cloud-architect',
           title: 'Cloud Architecture',
           description: 'Design and implement scalable cloud solutions',
           skills: ['AWS', 'Docker', 'Kubernetes', 'Microservices'],
           estimatedDuration: '5 months',
           difficulty: 'Advanced',
           matchScore: 82
         },
         {
           id: 'mobile-dev-roadmap',
           title: 'Mobile App Development',
           description: 'Build native and cross-platform mobile applications',
           skills: ['React Native', 'Flutter', 'Swift', 'Kotlin'],
           estimatedDuration: '5 months',
           difficulty: 'Intermediate',
           matchScore: 75
         },
         {
           id: 'cybersecurity-roadmap',
           title: 'Cybersecurity Specialist',
           description: 'Protect systems and networks from digital attacks',
           skills: ['Network Security', 'Penetration Testing', 'CISSP', 'Ethical Hacking'],
           estimatedDuration: '8 months',
           difficulty: 'Advanced',
           matchScore: 88
         },
         {
           id: 'data-science-roadmap',
           title: 'Data Science & Analytics',
           description: 'Extract insights from complex datasets',
           skills: ['Python', 'R', 'SQL', 'Tableau', 'Statistics'],
           estimatedDuration: '6 months',
           difficulty: 'Intermediate',
           matchScore: 80
         },
         {
           id: 'blockchain-roadmap',
           title: 'Blockchain Development',
           description: 'Build decentralized applications and smart contracts',
           skills: ['Solidity', 'Web3.js', 'Ethereum', 'Smart Contracts'],
           estimatedDuration: '7 months',
           difficulty: 'Advanced',
           matchScore: 72
         },
         {
           id: 'devops-roadmap',
           title: 'DevOps Engineering',
           description: 'Streamline development and deployment processes',
           skills: ['Jenkins', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
           estimatedDuration: '5 months',
           difficulty: 'Intermediate',
           matchScore: 83
         },
         {
           id: 'ui-ux-roadmap',
           title: 'UI/UX Design',
           description: 'Create intuitive and engaging user experiences',
           skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
           estimatedDuration: '4 months',
           difficulty: 'Beginner',
           matchScore: 76
         },
         {
           id: 'backend-roadmap',
           title: 'Backend Development',
           description: 'Build robust server-side applications and APIs',
           skills: ['Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'REST APIs'],
           estimatedDuration: '5 months',
           difficulty: 'Intermediate',
           matchScore: 79
         },
         {
           id: 'game-dev-roadmap',
           title: 'Game Development',
           description: 'Create engaging games for multiple platforms',
           skills: ['Unity', 'C#', 'Unreal Engine', 'Game Design'],
           estimatedDuration: '6 months',
           difficulty: 'Intermediate',
           matchScore: 74
         },
         {
           id: 'qa-automation-roadmap',
           title: 'QA Automation Engineer',
           description: 'Automate testing processes for software quality',
           skills: ['Selenium', 'TestNG', 'Cypress', 'API Testing'],
           estimatedDuration: '4 months',
           difficulty: 'Intermediate',
           matchScore: 77
         },
         {
           id: 'product-manager-roadmap',
           title: 'Product Management',
           description: 'Lead product strategy and development lifecycle',
           skills: ['Product Strategy', 'Agile', 'User Stories', 'Analytics'],
           estimatedDuration: '3 months',
           difficulty: 'Beginner',
           matchScore: 81
         },
         {
           id: 'digital-marketing-roadmap',
           title: 'Digital Marketing',
           description: 'Master online marketing strategies and tools',
           skills: ['SEO', 'Google Ads', 'Social Media', 'Content Marketing'],
           estimatedDuration: '3 months',
           difficulty: 'Beginner',
           matchScore: 73
         },
         {
           id: 'system-admin-roadmap',
           title: 'System Administration',
           description: 'Manage and maintain IT infrastructure',
           skills: ['Linux', 'Windows Server', 'Networking', 'Bash Scripting'],
           estimatedDuration: '5 months',
           difficulty: 'Intermediate',
           matchScore: 78
         },
         {
           id: 'embedded-systems-roadmap',
           title: 'Embedded Systems',
           description: 'Develop software for embedded hardware devices',
           skills: ['C/C++', 'Arduino', 'Raspberry Pi', 'Microcontrollers'],
           estimatedDuration: '6 months',
           difficulty: 'Advanced',
           matchScore: 84
         },
         {
           id: 'salesforce-roadmap',
           title: 'Salesforce Development',
           description: 'Build custom solutions on the Salesforce platform',
           skills: ['Apex', 'Lightning', 'SOQL', 'Salesforce Admin'],
           estimatedDuration: '4 months',
           difficulty: 'Intermediate',
           matchScore: 76
         },
         {
           id: 'business-analyst-roadmap',
           title: 'Business Analysis',
           description: 'Bridge business needs with technical solutions',
           skills: ['Requirements Analysis', 'Process Modeling', 'SQL', 'Tableau'],
           estimatedDuration: '3 months',
           difficulty: 'Beginner',
           matchScore: 75
         },
         {
           id: 'network-engineer-roadmap',
           title: 'Network Engineering',
           description: 'Design and maintain network infrastructure',
           skills: ['CCNA', 'TCP/IP', 'Routing', 'Switching', 'Network Security'],
           estimatedDuration: '6 months',
           difficulty: 'Intermediate',
           matchScore: 82
         },
         {
           id: 'database-admin-roadmap',
           title: 'Database Administration',
           description: 'Manage and optimize database systems',
           skills: ['MySQL', 'PostgreSQL', 'Oracle', 'Database Tuning'],
           estimatedDuration: '5 months',
           difficulty: 'Intermediate',
           matchScore: 80
         },
         {
           id: 'frontend-specialist-roadmap',
           title: 'Frontend Specialist',
           description: 'Master modern frontend technologies and frameworks',
           skills: ['React', 'Vue.js', 'TypeScript', 'Webpack', 'CSS3'],
           estimatedDuration: '4 months',
           difficulty: 'Intermediate',
           matchScore: 77
         },
         {
           id: 'python-automation-roadmap',
           title: 'Python Automation Engineer',
           description: 'Automate tasks and processes using Python',
           skills: ['Python', 'Selenium', 'APIs', 'Scripting', 'Task Automation'],
           estimatedDuration: '4 months',
           difficulty: 'Beginner',
           matchScore: 79
         },
         {
           id: 'microservices-roadmap',
           title: 'Microservices Architecture',
           description: 'Design and implement microservices-based systems',
           skills: ['Docker', 'Kubernetes', 'API Gateway', 'Service Mesh'],
           estimatedDuration: '6 months',
           difficulty: 'Advanced',
           matchScore: 85
         },
         {
           id: 'machine-learning-ops-roadmap',
           title: 'MLOps Engineer',
           description: 'Deploy and manage machine learning models in production',
           skills: ['MLflow', 'Kubeflow', 'Docker', 'Model Deployment'],
           estimatedDuration: '5 months',
           difficulty: 'Advanced',
           matchScore: 86
         },
         {
           id: 'technical-writing-roadmap',
           title: 'Technical Writing',
           description: 'Create clear documentation and technical content',
           skills: ['Documentation', 'Markdown', 'API Docs', 'Content Strategy'],
           estimatedDuration: '3 months',
           difficulty: 'Beginner',
           matchScore: 71
         }
       ];
      
      // Apply pagination to mock roadmaps
      const paginatedMockRoadmaps = mockRoadmaps.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedMockRoadmaps,
        count: paginatedMockRoadmaps.length,
        totalCount: mockRoadmaps.length,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(mockRoadmaps.length / pageSizeNum),
        message: 'Retrieved personalized roadmaps (fallback)'
      });
    }
  } catch (error) {
    console.error('Error in personalized-roadmaps:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get recommended skills based on current skills
router.get('/recommendations/:userId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    
    // Validate that the requesting user can access this data
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile = await UserProfile.findByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Generate recommendations based on current skills
    const recommendations = await generateSkillRecommendations(profile.currentSkills);
    
    res.json({ skills: recommendations });
  } catch (error) {
    console.error('Error generating skill recommendations:', error);
    next(error);
  }
});

// Get career advancement pathways
router.post('/career-pathways', requireAuth, [
  body('currentSkills').isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentSkills, targetRole } = req.body;
    
    // Generate career pathways
    const pathways = await generateCareerPathways(currentSkills, targetRole);
    
    res.json({ pathways });
  } catch (error) {
    console.error('Error generating career pathways:', error);
    next(error);
  }
});

// Get skill relationships and dependencies
router.get('/relationships/:skillName', async (req, res, next) => {
  try {
    const skillName = req.params.skillName;
    
    if (!skillName || skillName.trim().length === 0) {
      return res.status(400).json({ error: 'Skill name is required' });
    }

    const relationships = await getSkillRelationships(skillName);
    
    res.json(relationships);
  } catch (error) {
    console.error('Error getting skill relationships:', error);
    next(error);
  }
});

// Get trending skills
router.get('/trending', async (req, res, next) => {
  try {
    const trendingSkills = getTrendingSkills([]);
    res.json({ skills: trendingSkills });
  } catch (error) {
    next(error);
  }
});

// Skills search endpoint
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Mock skills database - in production this would query a real database
    const allSkills = [
      'JavaScript', 'Python', 'Java', 'C++', 'React', 'Angular', 'Vue.js',
      'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'MongoDB',
      'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS',
      'Azure', 'Google Cloud', 'Machine Learning', 'Data Science',
      'Artificial Intelligence', 'TensorFlow', 'PyTorch', 'Pandas',
      'NumPy', 'Scikit-learn', 'HTML', 'CSS', 'SASS', 'TypeScript',
      'GraphQL', 'REST API', 'Microservices', 'DevOps', 'CI/CD',
      'Git', 'GitHub', 'GitLab', 'Agile', 'Scrum', 'Project Management'
    ];
    
    const query = q.toLowerCase().trim();
    const matchingSkills = allSkills.filter(skill => 
      skill.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
    
    res.json({ skills: matchingSkills });
   } catch (error) {
     next(error);
   }
 });

// Generate AI-powered personalized roadmap recommendations
router.get('/ai-recommendations/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    
    const result = await generateRoadmapWithLLM(userId);
    res.json(result);
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate AI recommendations',
      message: error.message 
    });
  }
});

// Generate skill suggestions based on goal and current skills
router.post('/suggest', [
  body('goal').optional().isString().trim().withMessage('Goal must be a string'),
  body('currentSkills').optional().isArray().withMessage('Current skills must be an array'),
  body('targetRole').optional().isString().trim().withMessage('Target role must be a string')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { goal, currentSkills = [], targetRole } = req.body;
    
    // Generate skill suggestions using the service
    const suggestions = await generateSkillSuggestions(goal, currentSkills, targetRole, false);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating skill suggestions:', error);
    next(error);
  }
});

/**
 * Generate skill recommendations based on current skills
 * @param {Array} currentSkills - User's current skills with proficiency levels
 * @returns {Promise<Array>} Array of recommended skills
 */
async function generateSkillRecommendations(currentSkills) {
  try {
    // Extract skill names for analysis
    const skillNames = currentSkills.map(skill => skill.skillName);
    
    // Define skill categories and relationships
    const skillCategories = {
      'Frontend': ['JavaScript', 'React', 'Angular', 'Vue.js', 'HTML', 'CSS', 'TypeScript'],
      'Backend': ['Node.js', 'Python', 'Java', 'Express.js', 'Django', 'Spring Boot'],
      'Database': ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis'],
      'Cloud': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes'],
      'Data Science': ['Python', 'R', 'Machine Learning', 'Statistics', 'Pandas', 'NumPy'],
      'Mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin'],
      'DevOps': ['Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Terraform'],
      'Security': ['Cybersecurity', 'Ethical Hacking', 'Network Security']
    };

    // Skill progression paths
    const progressionPaths = {
      'JavaScript': ['TypeScript', 'React', 'Node.js', 'Vue.js', 'Angular'],
      'Python': ['Django', 'Flask', 'Machine Learning', 'Data Science', 'FastAPI'],
      'React': ['Next.js', 'Redux', 'React Native', 'TypeScript'],
      'Node.js': ['Express.js', 'NestJS', 'GraphQL', 'MongoDB'],
      'HTML': ['CSS', 'JavaScript', 'React', 'Angular'],
      'CSS': ['SASS', 'Tailwind CSS', 'JavaScript', 'React'],
      'Machine Learning': ['Deep Learning', 'TensorFlow', 'PyTorch', 'MLOps'],
      'AWS': ['Docker', 'Kubernetes', 'Terraform', 'DevOps'],
      'Docker': ['Kubernetes', 'DevOps', 'CI/CD', 'Microservices']
    };

    const recommendations = [];
    const currentSkillNames = skillNames.map(name => name.toLowerCase());

    // Generate recommendations based on current skills
    for (const skill of skillNames) {
      const progressions = progressionPaths[skill] || [];
      
      for (const nextSkill of progressions) {
        if (!currentSkillNames.includes(nextSkill.toLowerCase())) {
          const recommendation = {
            skillName: nextSkill,
            relevanceScore: calculateRelevanceScore(skill, nextSkill, currentSkills),
            difficultyLevel: getDifficultyLevel(nextSkill),
            estimatedLearningTime: getEstimatedLearningTime(nextSkill),
            prerequisites: getPrerequisites(nextSkill),
            careerImpact: getCareerImpact(nextSkill),
            demandLevel: getDemandLevel(nextSkill),
            relatedRoles: getRelatedRoles(nextSkill),
            reason: `Builds upon your ${skill} knowledge`
          };
          
          // Avoid duplicates
          if (!recommendations.find(r => r.skillName === nextSkill)) {
            recommendations.push(recommendation);
          }
        }
      }
    }

    // Add trending skills based on current skill categories
    const trendingSkills = getTrendingSkills(currentSkills);
    for (const trending of trendingSkills) {
      if (!currentSkillNames.includes(trending.skillName.toLowerCase()) &&
          !recommendations.find(r => r.skillName === trending.skillName)) {
        recommendations.push(trending);
      }
    }

    // Sort by relevance score and return top 10
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
      
  } catch (error) {
    console.error('Error in generateSkillRecommendations:', error);
    return [];
  }
}

/**
 * Generate career advancement pathways
 * @param {Array} currentSkills - User's current skills
 * @param {string} targetRole - Target role (optional)
 * @returns {Promise<Array>} Array of career pathways
 */
async function generateCareerPathways(currentSkills, targetRole) {
  try {
    const pathways = [];
    
    // Define role-based skill requirements
    const roleRequirements = {
      'Full Stack Developer': {
        required: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'HTML', 'CSS'],
        advanced: ['TypeScript', 'GraphQL', 'Docker', 'AWS'],
        estimatedDuration: '6-9 months'
      },
      'Data Scientist': {
        required: ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Pandas'],
        advanced: ['Deep Learning', 'TensorFlow', 'Big Data', 'MLOps'],
        estimatedDuration: '8-12 months'
      },
      'DevOps Engineer': {
        required: ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'AWS'],
        advanced: ['Terraform', 'Monitoring', 'Security', 'Microservices'],
        estimatedDuration: '6-8 months'
      },
      'Frontend Developer': {
        required: ['JavaScript', 'React', 'HTML', 'CSS', 'TypeScript'],
        advanced: ['Next.js', 'Testing', 'Performance Optimization', 'Accessibility'],
        estimatedDuration: '4-6 months'
      },
      'Backend Developer': {
        required: ['Node.js', 'Python', 'MongoDB', 'API Design', 'SQL'],
        advanced: ['Microservices', 'GraphQL', 'Caching', 'Security'],
        estimatedDuration: '5-7 months'
      }
    };

    const currentSkillNames = currentSkills.map(skill => skill.toLowerCase());
    
    // Generate pathways for each role
    for (const [role, requirements] of Object.entries(roleRequirements)) {
      if (targetRole && role !== targetRole) continue;
      
      const requiredSkills = requirements.required.filter(skill => 
        !currentSkillNames.includes(skill.toLowerCase())
      );
      
      const advancedSkills = requirements.advanced.filter(skill => 
        !currentSkillNames.includes(skill.toLowerCase())
      );
      
      if (requiredSkills.length > 0 || advancedSkills.length > 0) {
        const pathway = {
          pathwayName: `Path to ${role}`,
          targetRole: role,
          requiredSkills: [...requiredSkills, ...advancedSkills].map((skill, index) => ({
            skillName: skill,
            currentLevel: 'None',
            targetLevel: requirements.required.includes(skill) ? 'Intermediate' : 'Advanced',
            priority: requirements.required.includes(skill) ? 9 - index : 5 - index,
            estimatedTime: getEstimatedLearningTime(skill)
          })),
          estimatedDuration: requirements.estimatedDuration,
          difficultyLevel: calculatePathwayDifficulty(requiredSkills, advancedSkills),
          marketDemand: getMarketDemand(role)
        };
        
        pathways.push(pathway);
      }
    }
    
    return pathways.sort((a, b) => b.marketDemand - a.marketDemand);
    
  } catch (error) {
    console.error('Error in generateCareerPathways:', error);
    return [];
  }
}

/**
 * Get skill relationships and dependencies
 * @param {string} skillName - Name of the skill
 * @returns {Promise<Object>} Skill relationships object
 */
async function getSkillRelationships(skillName) {
  try {
    const relationships = {
      skillName,
      prerequisites: [],
      complementarySkills: [],
      advancedSkills: [],
      relatedRoles: [],
      learningPath: []
    };

    // Define skill relationships
    const skillRelationships = {
      'React': {
        prerequisites: ['JavaScript', 'HTML', 'CSS'],
        complementarySkills: ['TypeScript', 'Redux', 'React Router'],
        advancedSkills: ['Next.js', 'React Native', 'GraphQL'],
        relatedRoles: ['Frontend Developer', 'Full Stack Developer', 'React Developer'],
        learningPath: ['JavaScript', 'HTML/CSS', 'React Basics', 'State Management', 'Advanced React']
      },
      'Python': {
        prerequisites: ['Programming Fundamentals'],
        complementarySkills: ['Git', 'Linux', 'SQL'],
        advancedSkills: ['Django', 'Flask', 'Machine Learning', 'Data Science'],
        relatedRoles: ['Backend Developer', 'Data Scientist', 'Python Developer'],
        learningPath: ['Python Basics', 'OOP', 'Libraries', 'Frameworks', 'Specialization']
      },
      'Machine Learning': {
        prerequisites: ['Python', 'Statistics', 'Linear Algebra'],
        complementarySkills: ['Pandas', 'NumPy', 'Matplotlib'],
        advancedSkills: ['Deep Learning', 'TensorFlow', 'PyTorch', 'MLOps'],
        relatedRoles: ['Data Scientist', 'ML Engineer', 'AI Researcher'],
        learningPath: ['Math Foundations', 'Python', 'ML Algorithms', 'Model Building', 'Deployment']
      },
      'Docker': {
        prerequisites: ['Linux', 'Command Line'],
        complementarySkills: ['Git', 'CI/CD'],
        advancedSkills: ['Kubernetes', 'Docker Compose', 'Microservices'],
        relatedRoles: ['DevOps Engineer', 'Backend Developer', 'Cloud Engineer'],
        learningPath: ['Containerization Basics', 'Docker Commands', 'Dockerfile', 'Docker Compose', 'Orchestration']
      }
    };

    const skillData = skillRelationships[skillName];
    if (skillData) {
      Object.assign(relationships, skillData);
    } else {
      // Generate basic relationships for unknown skills
      relationships.prerequisites = ['Programming Fundamentals'];
      relationships.relatedRoles = ['Software Developer'];
      relationships.learningPath = ['Basics', 'Intermediate', 'Advanced'];
    }

    return relationships;
    
  } catch (error) {
    console.error('Error in getSkillRelationships:', error);
    return {
      skillName,
      prerequisites: [],
      complementarySkills: [],
      advancedSkills: [],
      relatedRoles: [],
      learningPath: []
    };
  }
}

// Helper functions
function calculateRelevanceScore(baseSkill, targetSkill, currentSkills) {
  // Base score
  let score = 70;
  
  // Boost score based on skill relationships
  const synergies = {
    'JavaScript': ['TypeScript', 'React', 'Node.js'],
    'Python': ['Django', 'Machine Learning', 'Data Science'],
    'React': ['Next.js', 'React Native', 'Redux'],
    'AWS': ['Docker', 'Kubernetes', 'DevOps']
  };
  
  if (synergies[baseSkill]?.includes(targetSkill)) {
    score += 20;
  }
  
  return Math.min(score, 95);
}

function getDifficultyLevel(skillName) {
  const difficulties = {
    'HTML': 'Easy',
    'CSS': 'Easy',
    'JavaScript': 'Medium',
    'React': 'Medium',
    'Node.js': 'Medium',
    'Machine Learning': 'Hard',
    'Kubernetes': 'Hard',
    'System Design': 'Hard'
  };
  
  return difficulties[skillName] || 'Medium';
}

function getEstimatedLearningTime(skillName) {
  const times = {
    'HTML': '2-3 weeks',
    'CSS': '3-4 weeks',
    'JavaScript': '2-3 months',
    'React': '1-2 months',
    'Node.js': '1-2 months',
    'Machine Learning': '4-6 months',
    'Kubernetes': '2-3 months',
    'Docker': '3-4 weeks'
  };
  
  return times[skillName] || '1-2 months';
}

function getPrerequisites(skillName) {
  const prerequisites = {
    'React': ['JavaScript', 'HTML', 'CSS'],
    'Node.js': ['JavaScript'],
    'TypeScript': ['JavaScript'],
    'Machine Learning': ['Python', 'Statistics'],
    'Kubernetes': ['Docker', 'Linux'],
    'Next.js': ['React', 'JavaScript']
  };
  
  return prerequisites[skillName] || [];
}

function getCareerImpact(skillName) {
  const impacts = {
    'React': 85,
    'Python': 90,
    'Machine Learning': 95,
    'AWS': 88,
    'Kubernetes': 85,
    'TypeScript': 80,
    'Docker': 82
  };
  
  return impacts[skillName] || 75;
}

function getDemandLevel(skillName) {
  const demands = {
    'React': 'High',
    'Python': 'High',
    'Machine Learning': 'High',
    'AWS': 'High',
    'JavaScript': 'High',
    'Docker': 'Medium',
    'Kubernetes': 'Medium'
  };
  
  return demands[skillName] || 'Medium';
}

function getRelatedRoles(skillName) {
  const roles = {
    'React': ['Frontend Developer', 'Full Stack Developer', 'React Developer'],
    'Python': ['Backend Developer', 'Data Scientist', 'Python Developer'],
    'Machine Learning': ['Data Scientist', 'ML Engineer', 'AI Researcher'],
    'AWS': ['Cloud Engineer', 'DevOps Engineer', 'Solutions Architect'],
    'Docker': ['DevOps Engineer', 'Backend Developer', 'Cloud Engineer']
  };
  
  return roles[skillName] || ['Software Developer'];
}

function getTrendingSkills(currentSkills) {
  const trending = [
    {
      skillName: 'AI/Machine Learning',
      relevanceScore: 95,
      difficultyLevel: 'Hard',
      estimatedLearningTime: '4-6 months',
      prerequisites: ['Python', 'Statistics'],
      careerImpact: 95,
      demandLevel: 'High',
      relatedRoles: ['AI Engineer', 'Data Scientist'],
      reason: 'Highest growth technology in 2024'
    },
    {
      skillName: 'Cloud Computing',
      relevanceScore: 90,
      difficultyLevel: 'Medium',
      estimatedLearningTime: '2-3 months',
      prerequisites: ['Linux', 'Networking'],
      careerImpact: 88,
      demandLevel: 'High',
      relatedRoles: ['Cloud Engineer', 'DevOps Engineer'],
      reason: 'Essential for modern development'
    },
    {
      skillName: 'Cybersecurity',
      relevanceScore: 85,
      difficultyLevel: 'Hard',
      estimatedLearningTime: '3-4 months',
      prerequisites: ['Networking', 'Linux'],
      careerImpact: 90,
      demandLevel: 'High',
      relatedRoles: ['Security Analyst', 'Cybersecurity Engineer'],
      reason: 'Critical skill with high demand'
    }
  ];
  
  return trending;
}

function calculatePathwayDifficulty(requiredSkills, advancedSkills) {
  const baseScore = requiredSkills.length * 2 + advancedSkills.length * 3;
  return Math.min(Math.max(baseScore / 10, 1), 10);
}

function getMarketDemand(role) {
  const demands = {
    'Full Stack Developer': 95,
    'Data Scientist': 90,
    'DevOps Engineer': 88,
    'Frontend Developer': 85,
    'Backend Developer': 82
  };
  
  return demands[role] || 75;
}




module.exports = router;