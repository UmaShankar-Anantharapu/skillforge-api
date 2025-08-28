const ResumeTemplate = require('../models/ResumeTemplate');

/**
 * Seed default resume templates
 */
async function seedResumeTemplates() {
  try {
    // Check if templates already exist
    const existingTemplates = await ResumeTemplate.countDocuments();
    if (existingTemplates > 0) {
      console.log('Resume templates already exist, skipping seed...');
      return;
    }

    const templates = [
      {
        name: 'Modern Professional',
        description: 'Clean, modern design perfect for tech professionals and developers',
        category: 'modern',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'experience', order: 3, required: true, customizable: true },
          { name: 'skills', order: 4, required: true, customizable: true },
          { name: 'education', order: 5, required: true, customizable: true },
          { name: 'projects', order: 6, required: false, customizable: true },
          { name: 'certifications', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#0ea5e9',
            text: '#1e293b',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Inter',
            body: 'Inter',
            size: {
              heading: '18px',
              subheading: '16px',
              body: '14px',
              small: '12px'
            },
            weight: {
              heading: '600',
              subheading: '500',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm'
            },
            spacing: {
              section: '16px',
              item: '8px',
              line: '1.5'
            }
          },
          elements: {
            showBorders: false,
            showIcons: true,
            showDividers: true,
            borderRadius: '4px',
            shadowLevel: 'light'
          }
        },
        targetAudience: ['experienced', 'senior', 'technical'],
        industries: ['Technology', 'Software Development', 'Engineering'],
        features: ['ats-friendly', 'single-page', 'color-customizable', 'icon-support'],
        isDefault: true,
        isPremium: false,
        status: 'active'
      },
      {
        name: 'Classic Professional',
        description: 'Traditional, conservative design suitable for all industries',
        category: 'classic',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'experience', order: 3, required: true, customizable: true },
          { name: 'education', order: 4, required: true, customizable: true },
          { name: 'skills', order: 5, required: true, customizable: true },
          { name: 'certifications', order: 6, required: false, customizable: true },
          { name: 'projects', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#1f2937',
            secondary: '#6b7280',
            accent: '#374151',
            text: '#111827',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Times New Roman',
            body: 'Times New Roman',
            size: {
              heading: '16px',
              subheading: '14px',
              body: '12px',
              small: '11px'
            },
            weight: {
              heading: '700',
              subheading: '600',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '25mm',
              right: '25mm',
              bottom: '25mm',
              left: '25mm'
            },
            spacing: {
              section: '20px',
              item: '10px',
              line: '1.4'
            }
          },
          elements: {
            showBorders: false,
            showIcons: false,
            showDividers: true,
            borderRadius: '0px',
            shadowLevel: 'none'
          }
        },
        targetAudience: ['experienced', 'senior', 'executive'],
        industries: ['Finance', 'Legal', 'Healthcare', 'Government'],
        features: ['ats-friendly', 'single-page', 'font-customizable'],
        isDefault: false,
        isPremium: false,
        status: 'active'
      },
      {
        name: 'Creative Portfolio',
        description: 'Eye-catching design for creative professionals and designers',
        category: 'creative',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'projects', order: 3, required: true, customizable: true },
          { name: 'experience', order: 4, required: true, customizable: true },
          { name: 'skills', order: 5, required: true, customizable: true },
          { name: 'education', order: 6, required: false, customizable: true },
          { name: 'certifications', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#7c3aed',
            secondary: '#a78bfa',
            accent: '#c084fc',
            text: '#1f2937',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Poppins',
            body: 'Open Sans',
            size: {
              heading: '20px',
              subheading: '16px',
              body: '14px',
              small: '12px'
            },
            weight: {
              heading: '700',
              subheading: '600',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '15mm',
              right: '15mm',
              bottom: '15mm',
              left: '15mm'
            },
            spacing: {
              section: '18px',
              item: '10px',
              line: '1.6'
            }
          },
          elements: {
            showBorders: true,
            showIcons: true,
            showDividers: true,
            borderRadius: '8px',
            shadowLevel: 'medium'
          }
        },
        targetAudience: ['creative', 'fresher', 'experienced'],
        industries: ['Design', 'Marketing', 'Media', 'Arts'],
        features: ['color-customizable', 'font-customizable', 'icon-support', 'photo-support'],
        isDefault: false,
        isPremium: true,
        status: 'active'
      },
      {
        name: 'Minimal Clean',
        description: 'Simple, clean design focusing on content over decoration',
        category: 'minimal',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'experience', order: 3, required: true, customizable: true },
          { name: 'skills', order: 4, required: true, customizable: true },
          { name: 'education', order: 5, required: true, customizable: true },
          { name: 'projects', order: 6, required: false, customizable: true },
          { name: 'certifications', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#000000',
            secondary: '#666666',
            accent: '#333333',
            text: '#000000',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Helvetica',
            body: 'Helvetica',
            size: {
              heading: '16px',
              subheading: '14px',
              body: '12px',
              small: '11px'
            },
            weight: {
              heading: '600',
              subheading: '500',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '30mm',
              right: '30mm',
              bottom: '30mm',
              left: '30mm'
            },
            spacing: {
              section: '24px',
              item: '12px',
              line: '1.5'
            }
          },
          elements: {
            showBorders: false,
            showIcons: false,
            showDividers: false,
            borderRadius: '0px',
            shadowLevel: 'none'
          }
        },
        targetAudience: ['experienced', 'senior', 'executive'],
        industries: ['Technology', 'Consulting', 'Finance'],
        features: ['ats-friendly', 'single-page'],
        isDefault: false,
        isPremium: false,
        status: 'active'
      },
      {
        name: 'Technical Developer',
        description: 'Specialized template for software developers and engineers',
        category: 'technical',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'skills', order: 3, required: true, customizable: true },
          { name: 'experience', order: 4, required: true, customizable: true },
          { name: 'projects', order: 5, required: true, customizable: true },
          { name: 'education', order: 6, required: true, customizable: true },
          { name: 'certifications', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#059669',
            secondary: '#6b7280',
            accent: '#10b981',
            text: '#1f2937',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Fira Code',
            body: 'Source Sans Pro',
            size: {
              heading: '18px',
              subheading: '16px',
              body: '14px',
              small: '12px'
            },
            weight: {
              heading: '600',
              subheading: '500',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm'
            },
            spacing: {
              section: '16px',
              item: '8px',
              line: '1.5'
            }
          },
          elements: {
            showBorders: false,
            showIcons: true,
            showDividers: true,
            borderRadius: '4px',
            shadowLevel: 'light'
          }
        },
        targetAudience: ['technical', 'fresher', 'experienced'],
        industries: ['Technology', 'Software Development', 'Engineering', 'Startups'],
        features: ['ats-friendly', 'single-page', 'color-customizable', 'icon-support'],
        isDefault: false,
        isPremium: false,
        status: 'active'
      },
      {
        name: 'Fresh Graduate',
        description: 'Perfect template for students and recent graduates',
        category: 'modern',
        sections: [
          { name: 'personalInfo', order: 1, required: true, customizable: false },
          { name: 'professionalSummary', order: 2, required: true, customizable: true },
          { name: 'education', order: 3, required: true, customizable: true },
          { name: 'skills', order: 4, required: true, customizable: true },
          { name: 'projects', order: 5, required: true, customizable: true },
          { name: 'experience', order: 6, required: false, customizable: true },
          { name: 'certifications', order: 7, required: false, customizable: true }
        ],
        style: {
          colors: {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#60a5fa',
            text: '#1e293b',
            background: '#ffffff'
          },
          fonts: {
            heading: 'Inter',
            body: 'Inter',
            size: {
              heading: '18px',
              subheading: '16px',
              body: '14px',
              small: '12px'
            },
            weight: {
              heading: '600',
              subheading: '500',
              body: '400'
            }
          },
          layout: {
            pageSize: 'A4',
            margins: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm'
            },
            spacing: {
              section: '16px',
              item: '8px',
              line: '1.5'
            }
          },
          elements: {
            showBorders: false,
            showIcons: true,
            showDividers: true,
            borderRadius: '4px',
            shadowLevel: 'light'
          }
        },
        targetAudience: ['student', 'fresher'],
        industries: ['Technology', 'Engineering', 'Business', 'Any'],
        features: ['ats-friendly', 'single-page', 'color-customizable', 'icon-support'],
        isDefault: false,
        isPremium: false,
        status: 'active'
      }
    ];

    // Insert templates
    const insertedTemplates = await ResumeTemplate.insertMany(templates);
    console.log(`Successfully seeded ${insertedTemplates.length} resume templates`);

    return insertedTemplates;
  } catch (error) {
    console.error('Error seeding resume templates:', error);
    throw error;
  }
}

/**
 * Remove all resume templates (for testing)
 */
async function clearResumeTemplates() {
  try {
    const result = await ResumeTemplate.deleteMany({});
    console.log(`Removed ${result.deletedCount} resume templates`);
    return result;
  } catch (error) {
    console.error('Error clearing resume templates:', error);
    throw error;
  }
}

module.exports = {
  seedResumeTemplates,
  clearResumeTemplates
};

// Run seeding if this file is executed directly
if (require.main === module) {
  const mongoose = require('mongoose');
  
  async function runSeed() {
    try {
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillForge';
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      
      await seedResumeTemplates();
      
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  }
  
  runSeed();
}