import { buildJsonStructure } from './SpinExpressionBuilder';

const FETCH_TIMEOUT = 5000;

/**
 * Lightweight client for Camunda 7 REST API.
 * Fetches runtime variables from process history.
 */
export default class ApiClient {

  constructor(endpoint) {
    this._url = endpoint.url;
    this._authType = endpoint.authType;
    this._username = endpoint.username;
    this._password = endpoint.password;
    this._token = endpoint.token;
  }

  /**
   * Fetch the latest process instance for a given process definition key.
   * @param {string} processDefinitionKey
   * @returns {Promise<{id: string}|null>}
   */
  async getLatestProcessInstance(processDefinitionKey) {
    const params = new URLSearchParams({
      processDefinitionKey,
      sortBy: 'startTime',
      sortOrder: 'desc',
      maxResults: '1'
    });

    const response = await this._fetch('/history/process-instance?' + params.toString());

    if (!response.ok) {
      throw new Error('Failed to fetch process instances: ' + response.status);
    }

    const instances = await response.json();
    return instances.length > 0 ? instances[0] : null;
  }

  /**
   * Fetch all variable instances for a process instance.
   * @param {string} processInstanceId
   * @returns {Promise<Array<{name, type, category, source, jsonStructure?}>>}
   */
  async getVariables(processInstanceId) {
    const params = new URLSearchParams({
      processInstanceId,
      deserializeValues: 'false'
    });

    const response = await this._fetch('/history/variable-instance?' + params.toString());

    if (!response.ok) {
      throw new Error('Failed to fetch variables: ' + response.status);
    }

    const rawVars = await response.json();
    return rawVars.map(v => this._parseVariable(v));
  }

  _parseVariable(raw) {
    const variable = {
      name: raw.name,
      type: mapCamundaType(raw.type),
      value: raw.value,
      category: 'api-variable',
      source: {
        elementId: raw.activityInstanceId || 'process',
        elementName: 'Runtime (' + raw.state + ')',
        elementType: 'API'
      }
    };

    // For JSON/Object types, try to parse the value into a tree
    if ((raw.type === 'Json' || raw.type === 'Object') && raw.value) {
      try {
        const parsed = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
        variable.type = 'json';
        variable.jsonStructure = buildJsonStructure(parsed);
      } catch {
        // Not parseable — keep as string
      }
    }

    return variable;
  }

  async _fetch(path) {
    const url = this._url + path;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      return await fetch(url, {
        headers: this._getHeaders(),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  _getHeaders() {
    const headers = { accept: 'application/json' };

    if (this._authType === 'bearer' && this._token) {
      headers.authorization = 'Bearer ' + this._token;
    } else if (this._authType === 'basic' && this._username && this._password) {
      headers.authorization = 'Basic ' + window.btoa(this._username + ':' + this._password);
    }

    return headers;
  }
}

function mapCamundaType(camundaType) {
  switch (camundaType) {
  case 'String': return 'string';
  case 'Integer':
  case 'Long':
  case 'Short':
  case 'Double': return 'number';
  case 'Boolean': return 'boolean';
  case 'Date': return 'date';
  case 'Json': return 'json';
  case 'Object': return 'json';
  case 'Null': return 'null';
  default: return 'string';
  }
}
