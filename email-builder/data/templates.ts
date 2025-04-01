const templates = [
  {
    id: "cold-email-1",
    name: "Cold Email",
    subject: "AI-powered development partnership for [Recipient's Company]",
    body: `Hi [Recipient],

AI is doing what used to take full dev teams. It's cutting build time and cost fast.

I saw your open roles and really liked what you're building at [Recipient's Company]. Your work in the [industry] space is particularly impressive. I work directly with product-led teams as a hands-on partner, and I've helped teams ship production-ready products 75% faster without adding headcount.

The way I work with my team at Decodes is built for speed. We use AI across the stack to cut dev time, reduce cost, and ship clean, production-grade products fast.

Here's where I can plug into [Recipient's Company]:

    Design: [design_focus]

    Software Development: [dev_focus]

    AI Integration: [ai_focus]

I've attached a quick deck with examples. Let's connect if this sounds useful.

Best,
[Your Name]`
  }
  // You can add more templates here if needed
];

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export default templates; 