const axios = require('axios');

class CraterApiClient {
  constructor(baseURL, email, password, apiToken = null) {
    this.baseURL = baseURL;
    this.email = email;
    this.password = password;
    this.token = apiToken;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (this.token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await this.login();
            originalRequest.headers.Authorization = `Bearer ${this.token}`;
            return this.client(originalRequest);
          } catch (loginError) {
            return Promise.reject(loginError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async login() {
    if (this.token && !this.email) {
        throw new Error("Authentication failed: Invalid API Token");
    }
    try {
      const response = await this.client.post('/api/v1/auth/login', {
        email: this.email,
        password: this.password,
        device_name: 'mcp-server'
      });
      this.token = response.data.token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      return this.token;
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  }

  // Customers
  async listCustomers(params = {}) {
    const response = await this.client.get('/api/v1/customers', { params });
    return response.data;
  }

  async createCustomer(data) {
    const response = await this.client.post('/api/v1/customers', data);
    return response.data;
  }

  async getCustomer(id) {
    const response = await this.client.get(`/api/v1/customers/${id}`);
    return response.data;
  }

  async updateCustomer(id, data) {
    const response = await this.client.put(`/api/v1/customers/${id}`, data);
    return response.data;
  }

  async deleteCustomer(ids) {
    const response = await this.client.post('/api/v1/customers/delete', { ids });
    return response.data;
  }

  // Items
  async listItems(params = {}) {
    const response = await this.client.get('/api/v1/items', { params });
    return response.data;
  }

  async createItem(data) {
    const response = await this.client.post('/api/v1/items', data);
    return response.data;
  }

  // Invoices
  async listInvoices(params = {}) {
    const response = await this.client.get('/api/v1/invoices', { params });
    return response.data;
  }

  async createInvoice(data) {
    const response = await this.client.post('/api/v1/invoices', data);
    return response.data;
  }

  async getInvoice(id) {
    const response = await this.client.get(`/api/v1/invoices/${id}`);
    return response.data;
  }

  async updateInvoice(id, data) {
    const response = await this.client.put(`/api/v1/invoices/${id}`, data);
    return response.data;
  }

  async deleteInvoice(ids) {
    const response = await this.client.post('/api/v1/invoices/delete', { ids });
    return response.data;
  }

  async sendInvoice(id, data = {}) {
    const response = await this.client.post(`/api/v1/invoices/${id}/send`, data);
    return response.data;
  }

  // Estimates
  async listEstimates(params = {}) {
    const response = await this.client.get('/api/v1/estimates', { params });
    return response.data;
  }

  async createEstimate(data) {
    const response = await this.client.post('/api/v1/estimates', data);
    return response.data;
  }

  async getEstimate(id) {
    const response = await this.client.get(`/api/v1/estimates/${id}`);
    return response.data;
  }

  async updateEstimate(id, data) {
    const response = await this.client.put(`/api/v1/estimates/${id}`, data);
    return response.data;
  }

  async deleteEstimate(ids) {
    const response = await this.client.post('/api/v1/estimates/delete', { ids });
    return response.data;
  }

  // Payments
  async listPayments(params = {}) {
    const response = await this.client.get('/api/v1/payments', { params });
    return response.data;
  }

  async createPayment(data) {
    const response = await this.client.post('/api/v1/payments', data);
    return response.data;
  }

  // Expenses
   async listExpenses(params = {}) {
    const response = await this.client.get('/api/v1/expenses', { params });
    return response.data;
  }

  async createExpense(data) {
    const response = await this.client.post('/api/v1/expenses', data);
    return response.data;
  }

  async getExpense(id) {
    const response = await this.client.get(`/api/v1/expenses/${id}`);
    return response.data;
  }

  async deleteExpense(ids) {
    const response = await this.client.post('/api/v1/expenses/delete', { ids });
    return response.data;
  }

  // Settings
  async getSettings() {
    const response = await this.client.get('/api/v1/settings');
    return response.data;
  }
}

module.exports = CraterApiClient;
