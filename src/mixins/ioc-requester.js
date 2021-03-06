/* @polymerMixin */
export const IocRequesterMixin = (superClass) => class extends superClass {
  /**
   * Sets services for element's properties configured to be injected.
   * @return {void}
   */
  connectedCallback() {
    super.connectedCallback();

    // Inject services into properties
    let properties = this._getProperties(this.constructor);
    for (let [name, configuration] of Object.entries(properties)) {
      if(typeof configuration.inject !== 'undefined') {
        this.set(name, this._getService(configuration.inject));
      }
    }
    this.servicesInjectedCallback();
  }

  /**
   * Is called after dependencies are injected into the element's properties.
   * @return {void}
   */
  servicesInjectedCallback() {

  }

  /**
   * Gets complete property informations of an element by going up the inheritance tree.
   * @param  {Object} classConstructor The constructor of the element.
   * @return {Object} The property informations.
   */
  _getProperties(classConstructor) {
    let properties = classConstructor.properties;

    // If current class is HTMLElement, there is no base class with properties.
    if(!classConstructor.__proto__ || classConstructor.__proto__.name === 'HTMLElement') {
      return properties;
    }

    // Merge properties of current class and base class
    let baseProperties = this._getProperties(classConstructor.__proto__);
    return Object.assign({}, properties, baseProperties);
  }

  /**
   * Requests service from first IOC provider traversing up the DOM.
   * @param  {string} key The key of the service to be requested.
   * @return {Object} The requested service instance.
   */
  _getService(key) {
    let event = new CustomEvent('ioc-request', {
      detail: {
        key,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);

    return event.detail.result;
  }
};
