import { AppManager } from './appManager';
import App from './app';
import dotenv from 'dotenv';

// cf. https://stackoverflow.com/questions/41359407/typescript-ignore-imlicitly-any-type-when-importing-js-module
// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';

dotenv.config();
App.setAbsolutePathToAppJs(process.env.PRIVATE_KEY as string, process.env.CERT as string);

// const relativePathToLoggingFolder: string = './../../../server/logging';
const loggingFileName = 'timeTracker.log';
App.configureLogger(loggingFileName);

// start app
const port: number = routesConfig.port;
const hostname = routesConfig.hostname;
const app = new App(port, hostname);
app.configure();
app.configureExpress();
app.configureRest();
app.setupDatabaseConnection();

AppManager.registerAppClosingEvent(app, true);
