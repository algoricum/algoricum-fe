export function algoricumGoLiveTemplate({
  name,
  dashboardUrl,
}: {
  name: string;
  dashboardUrl: string;
}): { html: string; text: string } {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #f9f9f9; color: #2d3748;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h2 style="color: #4c1d95;">Congrats, ${name}!</h2>
        <p>Welcome to <strong>Algoricum</strong>.</p>
        <p>
          Starting now, every new inquiry gets fast, consistent follow‑up — without you lifting a finger.
        </p>
        <p>
          You don’t need to set anything up or change the way you work. We’ve already got everything running in the background.
        </p>
        <p>
          Want to see it in action? Your dashboard is where everything lives, updated in real time:
        </p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${dashboardUrl}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px;">
            Go to your dashboard →
          </a>
        </p>
        <p>
          Check in whenever you’d like. We’ll keep working behind the scenes to make sure more leads turn into booked consults.
        </p>
        <p>Glad you’re here,</p>
        <p><strong>Hilda</strong><br>Founder, Algoricum</p>
      </div>
    </div>
  `;

  const text = `
Congrats, ${name}!

Welcome to Algoricum.

Starting now, every new inquiry gets fast, consistent follow‑up — without you lifting a finger.

You don’t need to set anything up or change the way you work. We’ve already got everything running in the background.

Want to see it in action? Your dashboard is where everything lives, updated in real time:

Go to your dashboard → ${dashboardUrl}

Check in whenever you’d like. We’ll keep working behind the scenes to make sure more leads turn into booked consults.

Glad you’re here,
Hilda
Founder, Algoricum
  `;

  return { html, text };
}
