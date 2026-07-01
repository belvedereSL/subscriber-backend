const express = require("express");
const cors = require("cors");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();

// 1. Middleware
app.use(cors());
// Contentful webhooks send data as application/vnd.contentful.management.v1+json
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

// 3. Subscription Endpoint
app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const data = await resend.contacts.create({
      email: email,
      audienceId: process.env.RESEND_AUDIENCE_ID,
      unsubscribed: false,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// app.post("/api/webhook/contentful", async (req, res) => {
//   // Log the payload to your console to see exactly what arrives
//   console.log("Full Contentful Payload:", JSON.stringify(req.body, null, 2));

//   // The actual entry data is located here in the standard Contentful payload
//   const entry = req.body.fields || {};

//   // Accessing fields (ensure 'en-US' matches your locale)
//   const title = entry.title ? entry.title["en-US"] : "New Update";
//   const content = entry.body
//     ? entry.body["en-US"]
//     : "Please check the dashboard.";
//   const category = entry.category ? entry.category["en-US"] : "General";

//   // Check if this is a 'publish' event to avoid sending emails on 'save' (draft)
//   const eventType = req.headers["x-contentful-topic"];
//   if (eventType !== "ContentManagement.Entry.publish") {
//     return res.status(200).send("Ignored non-publish event");
//   }

//   try {
//     await resend.emails.send({
//       from: "newsletter@news.belvederesl.com",
//       to: "belvederesl01@gmail.com",
//       subject: `New Update: ${title}`,
//       html: `<h1>${title}</h1><p><strong>Category:</strong> ${category}</p><hr /><p>${content}</p>`,
//     });
//     res.status(200).send("Email sent successfully");
//   } catch (error) {
//     console.error("Resend Email Error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

app.post("/api/webhook/contentful", async (req, res) => {
  const entry = req.body.fields || {};
  const title = entry.title?.["en-US"] || "New Update";
  const content = entry.body?.["en-US"] || "Please check the dashboard.";

  try {
    // Instead of sending one email, we create a broadcast to the audience
    const broadcast = await resend.broadcasts.create({
      name: `Newsletter: ${title}`,
      from: "newsletter@news.belvederesl.com",
      subject: `New Update: ${title}`,
      html: `<h1>${title}</h1><p>${content}</p>`,
      audienceId: process.env.RESEND_AUDIENCE_ID, // Use the ID from your .env
      // send: true, // Set to true to send immediately
    });

    console.log("Broadcast created:", broadcast);
    res.status(200).send("Broadcast sent to all subscribers");
  } catch (error) {
    console.error("Broadcast Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
