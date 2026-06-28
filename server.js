const express = require("express");
const cors = require("cors");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();

// 1. Middleware
app.use(cors());
app.use(
  express.json({
    type: ["application/json", "application/vnd.contentful.management.v1+json"],
  }),
);

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// 2. Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// 3. Health check endpoint
app.get("/", (req, res) => {
  res.send("Subscriber API is running.");
});

// 4. The Subscribe Endpoint
app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const data = await resend.contacts.create({
      email: email,
      audienceId: process.env.RESEND_AUDIENCE_ID,
      unsubscribed: false,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. The Contentful Webhook Endpoint (Updated to fetch and email all subscribers)
app.post("/api/webhook/contentful", async (req, res) => {
  const fields = req.body && req.body.fields ? req.body.fields : null;

  if (!fields) {
    return res.status(200).send("No fields found.");
  }

  const title = fields.title ? fields.title["en-US"] : "No Title";
  const content = fields.body ? fields.body["en-US"] : "No body content.";
  const category = fields.category ? fields.category["en-US"] : "General";

  try {
    // 1. Fetch all contacts registered under your Resend Audience ID
    const contactsResponse = await resend.contacts.list({
      audienceId: process.env.RESEND_AUDIENCE_ID,
    });

    // 2. Extract and filter active email addresses
    const emailList = contactsResponse.data
      .filter((contact) => !contact.unsubscribed)
      .map((contact) => contact.email);

    if (emailList.length === 0) {
      return res.status(200).send("No active subscribers found to email.");
    }

    // 3. Broadcast the email to all extracted subscriber addresses
    await resend.emails.send({
      from: "onboarding@resend.dev", // ⚠️ Replace with your verified custom domain in production
      to: emailList,
      subject: `New Update: ${title}`,
      html: `
        <h1>${title}</h1>
        <p><strong>Category:</strong> ${category}</p>
        <hr />
        <p>${content}</p>
      `,
    });

    res.status(200).send("Email broadcasted to all subscribers successfully.");
  } catch (error) {
    console.error("Resend webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
