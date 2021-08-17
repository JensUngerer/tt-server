export class UrlHelpers {

  private static getStringAfterLastSlash(rawUrl: string) {
    const ONE_CHARACTER_AFTER_THE_SLASH = 1;
    const indexOfLastSlash = rawUrl.lastIndexOf('/');
    const suffix = rawUrl.substring(indexOfLastSlash + ONE_CHARACTER_AFTER_THE_SLASH);
    return suffix;
  }

  private static getPropertiesForm(urlSuffix: string) {
    const properties = urlSuffix.split('?');

    // DEBUGGING
    // Logger.instance.info(properties);

    return properties;
  }

  public static getDateFromUrlTimeStamp(rawUrl: string) {
    const rawRequestedDayTimeStamp = UrlHelpers.getIdFromUlr(rawUrl);
    const rawRequestedDay = parseInt(rawRequestedDayTimeStamp);
    const requestedDay = new Date(rawRequestedDay);
    return requestedDay;
  }

  public static getIdFromUlr(rawUrl: string) {
    const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);
    return suffix;
  }

  public static getProperty(rawUrl: string, propertyName: string) {
    // const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);
    // const properties = UrlHelpers.getPropertiesForm(suffix);

    // return properties[propertyName]

    const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);

    // DEBUGGING:
    // Logger.instance.info(suffix);

    const properties = UrlHelpers.getPropertiesForm(suffix);
    const foundPropertyKeyValuePair = properties.find((onePropertyKeyValuePair: string) => {
      return onePropertyKeyValuePair.includes(propertyName);
    });
    if (!foundPropertyKeyValuePair) {
      return null;
    }

    // DEBUGGING
    // Logger.instance.info(foundPropertyKeyValuePair);

    const indexOfEqualSign = foundPropertyKeyValuePair.indexOf('=');
    if (indexOfEqualSign === -1) {
      return null;
    }
    const ONE_CHARACTER_AFTER_THE_EQUAL_SIGN = 1;
    const propertyValue = foundPropertyKeyValuePair.substr(indexOfEqualSign + ONE_CHARACTER_AFTER_THE_EQUAL_SIGN);
    if (!propertyValue) {
      return null;
    }
    return propertyValue.toString();
  }

  public static getDateObjFromUrl(rawUrl: string, propertyName: string) {
    const propertyValue = UrlHelpers.getProperty(rawUrl, propertyName);
    if (propertyValue === null) {
      return null;
    }

    // DEBUGGING:
    // Logger.instance.info(propertyValue);

    return new Date(parseFloat(propertyValue));
  }

  static getBooleanProperty(rawUrl: string, propertyName: string): boolean {
    const propertyValue = UrlHelpers.getProperty(rawUrl, propertyName);
    if (propertyValue === null) {
      return false;
    }
    return JSON.parse(propertyValue);
  }
}
