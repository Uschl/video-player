export class ConfigurationValidator {
  /**
   * Initializes a new ConfigurationValidator instance.
   * @param {object} schema The schema of the configuration.
   * @return {ConfigurationValidator}  The new ConfigurationValidator instance.
   */
  constructor(schema) {
    this._schema = schema;
  }

  /**
   * Validates a configuration against the global schema.
   * @param  {object} configuration The configuration object.
   * @return {boolean} A value determining whether the configuration is valid or not.
   */
  validate(configuration) {
    return this._validateSubSchema(configuration, this._schema);
  }

  /**
   * Validates a configuration against a specific schema.
   * @param  {object} configuration The configuration object.
   * @param  {object} schema The schema to validate against.
   * @param  {string} [nodePath=null] The property path of the configuration.
   * @return {boolean} A value determining whether the configuration is valid or not.
   */
  _validateSubSchema(configuration, schema, nodePath = null) {
    return this._checkForMissingOptions(configuration, schema, nodePath) &&
           this._validatePresentOptions(configuration, schema, nodePath);
  }

  /**
   * Checks for required options that are missing the the configuration.
   * @param  {object} configuration The configuration object.
   * @param  {object} schema The schema to validate against.
   * @param  {string} [nodePath=null] The property path of the configuration.
   * @return {boolean} A value determining whether the configuration has mising options or not.
   */
  _checkForMissingOptions(configuration, schema, nodePath) {
    let presentOptions = Object.keys(configuration);
    let missingOptions = Object.entries(schema)
                               .filter(([k, v]) => v.required) // eslint-disable-line no-unused-vars
                               .map(([k, v]) => k) // eslint-disable-line no-unused-vars
                               .filter(k => !presentOptions.includes(k));
    if(missingOptions.length === 0)
      return true;

    let missingPropertyPaths = Object.values(missingOptions).map(key => this._getPropertyPath(nodePath, key));
    this._error(`The following options are required, but missing: ${JSON.stringify(missingPropertyPaths)}`);
    return false;
  }

  /**
   * Checks if the present options of a configuration are valid.
   * @param  {object} configuration The configuration object.
   * @param  {object} schema The schema to validate against.
   * @param  {string} [nodePath=null] The property path of the configuration.
   * @return {boolean} A value determining whether the present values are valid or not.
   */
  _validatePresentOptions(configuration, schema, nodePath) {
    let isValid = true;
    for (let [key, value] of Object.entries(configuration)) {
      let propertyPath = this._getPropertyPath(nodePath, key);

      // Ignore null values
      // eslint-disable-next-line eqeqeq
      if(value == null) {
        continue;
      }

      // Check if key is included in schema
      if(!Object.keys(schema).includes(key)) {
        this._warn(`Option "${propertyPath}" is unknown and therefore ignored.`);
        isValid = false;
        continue;
      }

      // Check if value type is valid
      let validType = schema[key].type;
      let actualType = this._getType(value);
      if(validType !== actualType) {
        this._error(`Option "${propertyPath}" must be of type ${validType}, but is ${actualType}.`);
        isValid = false;
        continue;
      }

      // Check if value is valid
      if(schema[key].options && !schema[key].options.includes(value)) {
        this._error(`Option "${propertyPath}" must be one of ${JSON.stringify(schema[key].options)}.`);
        isValid = false;
        continue;
      }
      if(schema[key].min && value < schema[key].min) {
        this._error(`Option "${propertyPath}" must be at least ${schema[key].min}.`);
        isValid = false;
        continue;
      }
      if(schema[key].max && value > schema[key].max) {
        this._error(`Option "${propertyPath}" must be not greater than ${schema[key].max}.`);
        isValid = false;
        continue;
      }
      if(schema[key].pattern && !schema[key].pattern.test(value)) {
        this._error(`Option "${propertyPath}" has an invalid value.`);
        isValid = false;
        continue;
      }

      // Validate sub schema, if present
      if(schema[key].schema) {
        if(schema[key].type === 'object') {
          // Check, if value matches schema
          isValid = this._validateSubSchema(value, schema[key].schema, propertyPath) && isValid;
        } else if(schema[key].type === 'array') {
          // Check, if each value matches schema
          for(let i = 0; i < value.length; i++) {
            isValid = this._validateSubSchema(value[i], schema[key].schema, `${propertyPath}[${i}]`) && isValid;
          }
        }
      }
    }

    return isValid;
  }

  /**
   * Gets the type of a value.
   * @param  {any} value The value.
   * @return {string} The value type.
   */
  _getType(value) {
    return Array.isArray(value) ? 'array' : typeof value;
  }

  /**
   * Constructs the property path of a option.
   * @param  {string} [propertyPath] The property path within the configuration.
   * @param  {string} option The option.
   * @return {string} The constructed property path
   */
  _getPropertyPath(propertyPath, option) {
    return propertyPath ? `${propertyPath}.${option}` : option;
  }

  /**
   * Prints an error message to the console.
   * @param  {string} message The message to print.
   * @return {void}
   */
  _error(message) {
    console.error(this._formatMessage(message));
  }

  /**
   * Prints an warning message to the console.
   * @param  {string} message The message to print.
   * @return {void}
   */
  _warn(message) {
    console.warn(this._formatMessage(message));
  }

  /**
   * Formats a console message.
   * @param  {string} message The plain message.
   * @return {string} The formatted message.
   */
  _formatMessage(message) {
    return`[video-player] Invalid configuration! ${message}`;
  }
}
