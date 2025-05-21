import { onRequest } from "firebase-functions/v2/https";
import { createTransport } from "nodemailer";
import express from "express";
import { defineSecret, defineString } from "firebase-functions/params";
import { render } from "@react-email/components";
import UserEmailRES from "./emails/UserEmailRES";
import AdminEmailRES from "./emails/AdminEmailRES";
import UserEmailRESAccepted from "./emails/UserEmailRESAccepted";
import UserEmailRESDeleted from "./emails/UserEmailRESDeleted";
import UserEmailForgottenPass from "./emails/UserEmailForgottenPass";
import EmailAddedToTraining from "./emails/EmailAddedToTraining";
import { ResetPasswordController } from "./controllers/reset-password.controller";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import UserEmailVerify from "./emails/UserEmailVerify";

// Create an Express app
const emailApp = express();
const resetPasswordApp = express();

// Create a rate limiter that allows 1 request per 15 minutes
// const rateLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15-minute window
//   max: 1, // Maximum 1 request per 15-minute window per IP
//   message: 'Too many requests. Please try again later.',
//   headers: true,
//   handler: (request, response, options) => {
//     console.error('Rate limit exceeded:', request.ip);
//     response.status(429).json({ error: 'Too many requests. Please try again later.' });
//   },
// });

// Apply the rate limiter middleware to the Express app
// app.use(rateLimiter);

const gmailUser = defineSecret("GMAIL_USER");
const gmailToken = defineSecret("GMAIL_TOKEN");
const appDomain = defineString("APP_DOMAIN");

const reservationBaseUrl = defineString("RESERVATIONS_BASE_URL");
const resetPassBaseUrl = defineString("RESET_PASS_BASE_URL");
const verifyUserBaseUrl = defineString("VERIFY_USER_BASE_URL");

interface EmailData {
  reservationId: string;

  emailData: {
    recipient: string;
    subject: string;
    userFirstName: string;
    userSecondName: string;
    userTelNumber: string;
    userEmail: string;
    course: string;
    courseName: string;
    date: string;
    startTime: string;
    endTime: string;
    lineNumber: number;
    emailIdentifier: string;
    promoCodesString: string;
    discipline: string;
    category: string;
    uuid: string;
  };
}

// interface EmailUserResData {
//   type: EmailType.EmailUserRes,
//   reservationUrl: string;
// }

// interface EmailAdminRes {
//   type: EmailType.EmailAdminRes,
//   baseUrl: string;
// }

// type EmnailData2 = EmailUserResData | EmailAdminRes;

enum EmailType {
  EmailUserRes = "USER_SUCCESS_RES",
  EmailAdminRes = "ADMIN_SUCCESS_RES",
  EmailUserResAccepted = "USER_ACCEPTED_RES",
  EmailUserResDeleted = "USER_DELETE_RES",
  EmailForgottenPassword = "USER_FORGOTTEN_PASSWORD",
  EmailVerifyUser = "USER_VERIFY_EMAIL",
  EmailAddedToTraining = "USER_ADDED_TO_TRAINING",
}

// const data: EmnailData2 = {};

// if (data.type === EmailType.EmailUserRes) {
//   data.reservationUrl
// }

// if (data.type === EmailType.EmailAdminRes) {
//   data.
// }

// tagged unions

const firebaseAdminApp = admin.initializeApp();
const adminAuth = getAuth();
const db = admin.firestore(firebaseAdminApp);
const resetPasswordController = new ResetPasswordController(
  firebaseAdminApp,
  adminAuth,
  db
);

resetPasswordApp.post("*", (req, res) => {
  return resetPasswordController.resetPassword(req, res);
});

// The POST endpoint that handles email sending
emailApp.post("*", async (request, response) => {
  try {
    // Create a Nodemailer transporter using SMTP
    const transporter = createTransport({
      service: "Gmail",
      auth: {
        user: gmailUser.value(),
        pass: gmailToken.value(),
      },
    });

    response.set("Access-Control-Allow-Origin", "*");
    if (request.method === "OPTIONS") {
      response.set("Access-Control-Allow-Methods", "GET");
      response.set("Access-Control-Allow-Headers", "Content-Type");
      response.set("Access-Control-Max-Age", "3600");
      response.status(204).send("");
      return;
    }

    const data = request.body.data as EmailData;

    const reservationUrl = `${reservationBaseUrl.value()}/${
      data.reservationId
    }`;

    let html = "";
    if (data.emailData.emailIdentifier === EmailType.EmailVerifyUser) {
      const verifyLink = `${verifyUserBaseUrl.value()}?uuid=${
        data.emailData.uuid
      }`;
      html = await render(UserEmailVerify({ ...data.emailData, verifyLink }));
    }

    if (data.emailData.emailIdentifier === EmailType.EmailUserRes) {
      html = await render(
        UserEmailRES({ ...data.emailData, baseUrl: reservationUrl })
      );
    }
    if (data.emailData.emailIdentifier === EmailType.EmailAdminRes) {
      html = await render(
        AdminEmailRES({ ...data.emailData, baseUrl: reservationUrl })
      );
    }
    if (data.emailData.emailIdentifier === EmailType.EmailUserResAccepted) {
      html = await render(UserEmailRESAccepted({ ...data.emailData }));
    }
    if (data.emailData.emailIdentifier === EmailType.EmailUserResDeleted) {
      html = await render(UserEmailRESDeleted({ ...data.emailData }));
    }
    if (data.emailData.emailIdentifier === EmailType.EmailAddedToTraining) {
      html = await render(EmailAddedToTraining({ ...data.emailData }));
    }
    if (data.emailData.emailIdentifier === EmailType.EmailForgottenPassword) {
      const resetLink = `${resetPassBaseUrl.value()}?uuid=${
        data.emailData.uuid
      }`;
      html = await render(
        UserEmailForgottenPass({ ...data.emailData, resetLink: resetLink })
      );
    }

    return transporter
      .sendMail({
        from: gmailUser.value(),
        to: data.emailData.recipient,
        subject: data.emailData.subject,
        html: html,
      })
      .then(() => {
        response.status(200).json({ result: "Email sent successfully" });
      })
      .catch((error) => {
        response.status(500).json({
          error: `Error sending email: ${error}`,
        });
      });
  } catch (error) {
    response.status(500).json({ error: `Error sending email: ${error}` });
  }
});

// Export the Express app with rate limiter applied and CORS enabled
export const sendEmail = onRequest(
  {
    secrets: [gmailUser, gmailToken],

    cors: ["http://localhost:5002", "http://127.0.0.1:5002", appDomain.value()],
  },
  emailApp
);

export const resetPassword = onRequest(
  {
    secrets: [gmailUser, gmailToken],
    cors: ["http://localhost:5002", "http://127.0.0.1:5002", appDomain.value()],
  },
  resetPasswordApp
);
