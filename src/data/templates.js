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
    sampleIntent: "Every day at 9 AM, fetch today's menu specials from the menu system, then post them to Facebook and Instagram",
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
    sampleIntent: "Check inventory levels every hour, and when any product stock drops below 10 units, send an email alert with the product details",
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
    sampleIntent: "When a new lead submits a contact form via webhook, save their information to Google Sheets, then send them a welcome email",
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
    sampleIntent: "Every day, check for homework assignments due in 2 days, then send email reminders to students and their parents",
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
    sampleIntent: "Every hour, check for appointments scheduled in 24 hours, then send SMS and email reminders to patients",
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
    sampleIntent: "Every day at 9 AM, 1 PM, and 5 PM, post scheduled content to Facebook, Instagram, Twitter, and LinkedIn",
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
    sampleIntent: "Every Monday at 9 AM, collect last week's metrics from analytics and CRM, compile them into a summary, then send an email digest to the team",
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
    sampleIntent: "Every day, collect expense data from bank and credit card APIs, save to Google Sheets, and on the 1st of each month, generate and email a monthly expense report",
    variables: [
      { key: "expense_sources", label: "Expense Sources", placeholder: "Bank, Credit Cards, Receipts" },
      { key: "categories", label: "Categories", placeholder: "Travel, Meals, Supplies" }
    ]
  },
  {
    id: "meeting-reminder-automation",
    name: "AI Meeting & Appointment Reminder",
    description: "Automatically check meeting schedules and send reminders via email, Telegram, or Zoom notifications when meetings are approaching.",
    industry: "Generic",
    promptHint: "Creating an automated meeting reminder system that checks schedules and sends notifications via multiple channels.",
    sampleIntent: "Every 15 minutes, check meeting schedule from Google Sheets, filter meetings starting in next 15 minutes, then send email reminder and Telegram notification with Zoom link",
    variables: [
      { key: "check_interval", label: "Check Interval", placeholder: "15 minutes" },
      { key: "reminder_time", label: "Reminder Time Before Meeting", placeholder: "15 minutes" },
      { key: "notification_methods", label: "Notification Methods", placeholder: "Email, Telegram, Zoom" }
    ]
  }
]
