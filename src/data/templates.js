/**
 * @type {import('../types').Template[]}
 */
export const templates = [
  {
    id: "fb-menu-daily-update",
    name: "F&B Menu Daily Update",
    description: "Automatically update daily menu specials from your menu management system and post to social media platforms.",
    industry: "F&B",
    promptHint: "Creating an automation for restaurant daily menu updates that syncs from a menu management system and posts to social media.",
    sampleIntent: "Update today's menu specials and post to Instagram and Facebook",
    variables: [
      { key: "menu_source", label: "Menu Source", placeholder: "Enter menu source URL" },
      { key: "social_accounts", label: "Social Accounts", placeholder: "Instagram, Facebook" }
    ]
  },
  {
    id: "retail-inventory-alert",
    name: "Retail Inventory Low Stock Alert",
    description: "Monitor inventory levels and send alerts via email or SMS when items fall below threshold.",
    industry: "Retail",
    promptHint: "Setting up automated inventory monitoring with low stock alerts via email and SMS notifications.",
    sampleIntent: "Alert me when any product stock drops below 10 units",
    variables: [
      { key: "threshold", label: "Stock Threshold", placeholder: "10" },
      { key: "alert_method", label: "Alert Method", placeholder: "Email, SMS" }
    ]
  },
  {
    id: "re-estate-lead-nurture",
    name: "Real Estate Lead Nurturing",
    description: "Capture new leads from forms, add them to CRM, and send automated follow-up email sequences.",
    industry: "Real Estate",
    promptHint: "Automating lead capture and nurturing workflow for real estate agents with CRM integration.",
    sampleIntent: "When a new lead submits a form, add them to CRM and send a welcome email series",
    variables: [
      { key: "lead_source", label: "Lead Source Form", placeholder: "Contact form URL" },
      { key: "crm_system", label: "CRM System", placeholder: "HubSpot, Salesforce" }
    ]
  },
  {
    id: "education-homework-reminder",
    name: "Education Homework Reminder",
    description: "Send automated homework reminders to students and parents based on assignment due dates.",
    industry: "Education",
    promptHint: "Creating automated homework reminder system that sends notifications to students and parents.",
    sampleIntent: "Remind students and parents 2 days before homework is due",
    variables: [
      { key: "reminder_days", label: "Days Before Due", placeholder: "2" },
      { key: "contact_list", label: "Contact List", placeholder: "Student emails" }
    ]
  },
  {
    id: "healthcare-appointment-reminder",
    name: "Healthcare Appointment Reminder",
    description: "Send SMS and email reminders to patients 24 hours before their scheduled appointment.",
    industry: "Healthcare",
    promptHint: "Setting up automated patient appointment reminders via SMS and email for healthcare providers.",
    sampleIntent: "Send patients a reminder 24 hours before their appointment",
    variables: [
      { key: "reminder_time", label: "Reminder Time", placeholder: "24 hours" },
      { key: "appointment_system", label: "Appointment System", placeholder: "Calendly, Clinic Software" }
    ]
  },
  {
    id: "va-social-scheduler",
    name: "VA Social Media Scheduler",
    description: "Schedule and publish social media posts across multiple platforms from a central content calendar.",
    industry: "VA/Freelance",
    promptHint: "Automating social media content scheduling and cross-platform publishing for virtual assistants.",
    sampleIntent: "Post to all social media platforms at 9 AM, 1 PM, and 5 PM daily",
    variables: [
      { key: "post_schedule", label: "Post Schedule", placeholder: "9 AM, 1 PM, 5 PM" },
      { key: "platforms", label: "Platforms", placeholder: "Facebook, Instagram, Twitter, LinkedIn" }
    ]
  },
  {
    id: "generic-email-digest",
    name: "Weekly Email Digest",
    description: "Collect data from multiple sources and compile into a weekly summary email.",
    industry: "Generic",
    promptHint: "Creating a weekly data aggregation and email digest automation that compiles information from various sources.",
    sampleIntent: "Send a weekly summary email every Monday with last week's key metrics",
    variables: [
      { key: "data_sources", label: "Data Sources", placeholder: "Analytics, CRM, Reports" },
      { key: "recipients", label: "Email Recipients", placeholder: "team@company.com" }
    ]
  },
  {
    id: "generic-expense-tracker",
    name: "Expense Report Tracker",
    description: "Track expenses from multiple sources, categorize them, and generate monthly expense reports.",
    industry: "Generic",
    promptHint: "Automating expense tracking and reporting workflow that consolidates expenses and generates monthly summaries.",
    sampleIntent: "Track all expenses and email a monthly report on the 1st of each month",
    variables: [
      { key: "expense_sources", label: "Expense Sources", placeholder: "Bank, Credit Cards, Receipts" },
      { key: "categories", label: "Categories", placeholder: "Travel, Meals, Supplies" }
    ]
  }
]
