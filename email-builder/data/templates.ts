export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const templates: EmailTemplate[] = [
  {
    id: 'cold',
    name: 'Cold Outreach',
    subject: 'Opportunity to collaborate with [Your Company]',
    body: `Hello [Recipient],

I hope this email finds you well. My name is [Your Name] from [Your Company], and I came across [Recipient's Company] while researching innovative companies in the [Industry] space.

I was particularly impressed by [specific achievement or aspect of their business], and I believe there might be potential for collaboration between our organizations.

Would you be open to a brief 15-minute conversation next week to explore how we might work together? I'm available on [specific dates/times], but I'm happy to accommodate your schedule.

Looking forward to your response.

Best regards,
[Your Name]
[Your Position]
[Your Company]`
  },
  {
    id: 'followup1',
    name: 'First Follow-up',
    subject: 'Following up on our potential collaboration',
    body: `Hello [Recipient],

I wanted to follow up on my previous email regarding a potential collaboration between [Your Company] and [Recipient's Company].

I understand you're likely busy, but I'm genuinely excited about the possibility of working together, especially considering your work on [specific project or achievement].

Would you be available for a quick call this week? I'd be happy to share some specific ideas on how we could create value together.

Looking forward to hearing from you.

Best regards,
[Your Name]
[Your Position]
[Your Company]`
  },
  {
    id: 'followup2',
    name: 'Second Follow-up',
    subject: 'One more follow-up on [Your Company] partnership',
    body: `Hello [Recipient],

I hope you're doing well. I wanted to reach out one more time about exploring potential synergies between our companies.

To give you a better idea of what I had in mind, here are a couple of specific ways we could collaborate:

1. [Specific collaboration idea #1]
2. [Specific collaboration idea #2]

If you're interested in discussing these opportunities further, please let me know what time works best for a brief conversation.

Best regards,
[Your Name]
[Your Position]
[Your Company]`
  },
  {
    id: 'followup3',
    name: 'Final Follow-up',
    subject: 'Final note regarding [Your Company] partnership',
    body: `Hello [Recipient],

I've reached out a few times about a potential collaboration between our companies, but I understand that timing isn't always right, or this might not be a priority for you at the moment.

If you're interested in discussing this in the future, please don't hesitate to reach out at [your email address].

In the meantime, I'll be following [Recipient's Company]'s progress and wish you all the best.

Best regards,
[Your Name]
[Your Position]
[Your Company]`
  }
];

export default templates; 