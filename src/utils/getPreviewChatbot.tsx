export const getPreviewText = (formData:any) => {
    const tone = formData.tone_selector || 'friendly';
    const formality = formData.formality_level || 'neutral';
    const length = formData.sentence_length || 'medium';

    const examples:any = {
      friendly: {
        very_casual: {
          short: "Hey! Happy to help! 😊",
          medium: "Hi there! I'm here to help with any questions about our clinic.",
          long: "Hey there! I'm really excited to help you with any questions you might have about our services, appointments, or anything else clinic-related."
        },
        casual: {
          short: "Hi! How can I help?",
          medium: "Hello! I'm here to assist you with any questions about our clinic.",
          long: "Hello! I'm here to help you with any questions or concerns you might have about our clinic services or appointments."
        },
        neutral: {
          short: "Hello, how may I assist you?",
          medium: "Hello! I'm here to help you with questions about our clinic services.",
          long: "Hello! I'm available to assist you with any questions about our clinic services, appointment scheduling, or general inquiries."
        },
        formal: {
          short: "Good day. How may I assist?",
          medium: "Good day. I'm available to assist you with clinic-related inquiries.",
          long: "Good day. I'm here to provide assistance with any questions regarding our clinic services, appointment scheduling, or other inquiries you may have."
        },
        very_formal: {
          short: "Greetings. How may I be of service?",
          medium: "Greetings. I am available to assist you with any clinic-related matters.",
          long: "Greetings. I am at your service to provide comprehensive assistance with any inquiries regarding our clinic services, appointment procedures, or related matters."
        }
      },
      professional: {
        very_casual: {
          short: "Hi! Ready to help!",
          medium: "Hi there! I'm ready to assist with your clinic needs today.",
          long: "Hi there! I'm ready to provide professional assistance with any questions about our clinic services or help you get what you need."
        },
        casual: {
          short: "Hello, how can I help?",
          medium: "Hello! I'm here to provide assistance with your clinic inquiries.",
          long: "Hello! I'm here to provide professional assistance with any questions about our clinic services or appointment needs."
        },
        neutral: {
          short: "Hello. How may I assist you?",
          medium: "Hello. I'm available to assist you with clinic-related inquiries.",
          long: "Hello. I'm available to provide professional assistance with any questions regarding our clinic services or appointment scheduling."
        },
        formal: {
          short: "Good day. How may I help?",
          medium: "Good day. I'm here to assist with your clinic-related needs.",
          long: "Good day. I'm here to provide professional assistance with any questions or concerns regarding our clinic services and procedures."
        },
        very_formal: {
          short: "Good day. How may I assist?",
          medium: "Good day. I am available to provide professional assistance.",
          long: "Good day. I am available to provide comprehensive professional assistance with any inquiries regarding our clinic services and procedures."
        }
      },
      casual: {
        very_casual: {
          short: "Hey! What's up? 👋",
          medium: "Hey there! What can I help you with today? Feel free to ask anything!",
          long: "Hey there! Hope you're having a great day! I'm here to help with whatever you need - questions about our clinic, appointments, you name it!"
        },
        casual: {
          short: "Hi! What can I help with?",
          medium: "Hi! What can I help you with regarding our clinic today?",
          long: "Hi! I'm here to help with whatever questions you have about our clinic, services, or anything else you need to know."
        },
        neutral: {
          short: "Hello, what do you need help with?",
          medium: "Hello, what can I help you with regarding our clinic services?",
          long: "Hello, I'm here to help answer questions about our clinic services, appointments, or any other information you might need."
        },
        formal: {
          short: "Hello. What assistance do you require?",
          medium: "Hello. What assistance can I provide regarding our clinic services?",
          long: "Hello. I'm available to provide assistance with questions about our clinic services, appointment scheduling, or other inquiries."
        },
        very_formal: {
          short: "Greetings. How may I assist?",
          medium: "Greetings. How may I assist you with clinic-related matters?",
          long: "Greetings. I am available to provide assistance with any inquiries you may have regarding our clinic services or procedures."
        }
      },
      formal: {
        very_casual: {
          short: "Hello! How can I help?",
          medium: "Hello! I'm here to help with any questions about our clinic.",
          long: "Hello! I'm available to help answer any questions you might have about our clinic services or procedures."
        },
        casual: {
          short: "Hello, how may I help you?",
          medium: "Hello, I'm available to assist with your clinic-related inquiries.",
          long: "Hello, I'm available to assist you with any questions or concerns regarding our clinic services and appointments."
        },
        neutral: {
          short: "Good day. How may I assist you?",
          medium: "Good day. I'm here to assist with any clinic-related inquiries.",
          long: "Good day. I'm here to assist you with any questions regarding our clinic services, appointment scheduling, or related matters."
        },
        formal: {
          short: "Good day. How may I be of service?",
          medium: "Good day. I'm available to provide assistance with clinic matters.",
          long: "Good day. I'm available to provide comprehensive assistance with any questions regarding our clinic services, procedures, or appointment scheduling."
        },
        very_formal: {
          short: "Greetings. How may I assist you?",
          medium: "Greetings. I am at your service for any clinic-related inquiries.",
          long: "Greetings. I am at your service to provide comprehensive assistance with any inquiries regarding our clinic services, procedures, and appointment scheduling."
        }
      }
    };

    return examples[tone]?.[formality]?.[length] || "Hello! How can I assist you today?";
  };