/**
 * Optimum API client.
 * Wraps all calls to the Optimum Live REST API.
 */
export class OptimumClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP ${response.status}`;
      throw new OptimumError(message, response.status, data);
    }

    return data;
  }

  // --- Clients ---

  async getClients(lastDate = null) {
    const params = lastDate ? `?last_date=${lastDate}` : "";
    return this._request("GET", `/api/clients/${params}`);
  }

  async getClient(clientId) {
    return this._request("GET", `/api/clients/${clientId}`);
  }

  async createClient(clientData) {
    return this._request("POST", "/api/clients", clientData);
  }

  async updateClient(clientId, clientData) {
    return this._request("PUT", `/api/clients/${clientId}`, clientData);
  }

  async getClientHistorique(clientId) {
    return this._request("GET", `/api/clients/${clientId}/historique`);
  }

  // --- Visites ---

  async createVisite(clientId, visiteData) {
    return this._request("POST", `/api/clients/${clientId}/visites/`, visiteData);
  }

  async getVisites(clientId) {
    return this._request("GET", `/api/clients/${clientId}/visites`);
  }

  // --- Offres ---

  async createOffre(clientId, visiteId, offreData) {
    return this._request("POST", `/api/clients/${clientId}/visites/${visiteId}/offres`, offreData);
  }

  // --- Ordonnance ---

  async uploadOrdonnanceScor(clientId, visiteId, base64Data) {
    return this._request("POST", `/api/clients/${clientId}/visites/${visiteId}/ordo_scor`, {
      fichier: base64Data,
    });
  }

  // --- Stocks ---

  async getStocks(articleTypesIds = [1, 3, 4, 5], dateFinStock = null) {
    const body = {
      articles_types_ids: articleTypesIds,
      date_fin_stock: dateFinStock || new Date().toLocaleDateString("fr-FR"),
    };
    return this._request("POST", "/api/stocks/", body);
  }

  async getStockMovements(sinceTimestamp) {
    return this._request("GET", `/api/stocks/mouvements?date_debut_mouvement=${sinceTimestamp}`);
  }

  // --- Référentiels ---

  async getMarques() {
    return this._request("GET", "/api/referentiel/marques");
  }

  async getFournisseurs() {
    return this._request("GET", "/api/referentiel/fournisseurs");
  }

  async getFabricants() {
    return this._request("GET", "/api/referentiel/fabricants");
  }

  // --- Catalogues ---

  async getCatalogueMontures() {
    return this._request("GET", "/api/catalogues_magasins/montures");
  }

  async getCatalogueVerres() {
    return this._request("GET", "/api/catalogues_magasins/verres");
  }

  // --- Utilisateurs ---

  async getUtilisateurs() {
    return this._request("GET", "/api/utilisateurs/");
  }
}

export class OptimumError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = "OptimumError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Create an OptimumClient from an erpConnection record.
 */
export function createOptimumClient(connection) {
  return new OptimumClient(connection.erpBaseUrl, connection.apiKey);
}
