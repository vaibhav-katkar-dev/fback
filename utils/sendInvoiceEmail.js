const {Resend} = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Function to generate email HTML
function generateInvoiceEmail(payment) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9fafb; padding: 30px; color: #333;">
  <div style="max-width: 600px; background: #ffffff; margin: auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 30px;">
    
    <h2 style="text-align:center; color:#2b6cb0; margin-bottom: 10px;">🧾 Payment Invoice</h2>
    <p style="text-align:center; color:#666; font-size:14px; margin-bottom:25px;">Thank you for your purchase from <strong>Form2Chat</strong></p>

    <p style="font-size:16px;">Hi <strong>${payment.user?.name || "User"}</strong>,</p>
    <p style="margin-bottom:20px;">We’ve successfully received your payment. Here are your transaction details:</p>

    <table style="width:100%; border-collapse: collapse; font-size:15px;">
      <tr style="background-color:#f3f4f6;">
        <td style="padding:10px; font-weight:bold;">Order ID:</td>
        <td style="padding:10px;">${payment.orderId}</td>
      </tr>
      <tr>
        <td style="padding:10px; font-weight:bold;">Payment ID:</td>
        <td style="padding:10px;">${payment.paymentId}</td>
      </tr>
      <tr style="background-color:#f3f4f6;">
        <td style="padding:10px; font-weight:bold;">Plan:</td>
        <td style="padding:10px;">${payment.planName}</td>
      </tr>
      <tr>
        <td style="padding:10px; font-weight:bold;">Amount:</td>
        <td style="padding:10px;">₹${payment.amountINR} (${payment.amountUSD} USD)</td>
      </tr>
      <tr style="background-color:#f3f4f6;">
        <td style="padding:10px; font-weight:bold;">Status:</td>
        <td style="padding:10px; color:green; font-weight:bold;">Success ✅</td>
      </tr>
    </table>

    <div style="margin-top:30px; text-align:center;">
      <p style="font-size:14px; color:#555;">If you have any issues, contact us at 
        <a href="mailto:form2chat@gmail.com" style="color:#2b6cb0; text-decoration:none;">form2chat@gmail.com</a>.
      </p>
      <p style="margin-top:10px; font-size:14px;">— The <strong>Form2Chat</strong> Team</p>
    </div>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:25px 0;">
    <p style="text-align:center; font-size:12px; color:#999;">
      © ${new Date().getFullYear()} Form2Chat. All rights reserved.
    </p>
  </div>
</div>

  `;
}

// ✅ Function to send email
async function sendInvoiceEmail(payment) {
  const html = generateInvoiceEmail(payment);

  await resend.emails.send({
    from: "Form2Chat <no-reply@form2chat.me>",
    to: payment.user?.email || "admin@form2chat.me",
    subject: `Invoice - ${payment.planName} Plan`,
    html,
  });

  console.log("📧 Invoice email sent successfully to:", payment.user?.email);
}

module.exports = { sendInvoiceEmail };
