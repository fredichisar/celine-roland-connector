/** @type { ActionRun } */
export const run = async ({ logger }) => {
  const apiKey = process.env.OPTIMUM_API_KEY;
  const baseUrl = process.env.OPTIMUM_BASE_URL;

  if (!apiKey || !baseUrl) {
    return { success: false, message: "Variables d'environnement OPTIMUM_API_KEY et OPTIMUM_BASE_URL non configurées" };
  }

  try {
    const response = await fetch(`${baseUrl}/api/referentiel/marques`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Optimum API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const count = typeof data === "object" ? Object.keys(data).length : 0;

    logger.info({ count }, "Optimum connection test successful");

    return {
      success: true,
      message: `Connecté — ${count} marques dans le référentiel`,
    };
  } catch (error) {
    logger.error({ error: error.message }, "Optimum connection test failed");
    return { success: false, message: error.message };
  }
};

export const params = {};
