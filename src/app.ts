import bodyParser from 'body-parser';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import helmet from 'helmet';
import mongoose, { Connection, Document, Model } from 'mongoose';
import passport from 'passport';
import path, { resolve } from 'path';
import https, { Server, ServerOptions } from 'https';

// @ts-ignore
import * as routesConfig from './../../common/typescript/routes.js';

import { MonogDbOperations } from './classes/helpers/mongoDbOperations';
import bookingDeclarationRoute from './classes/routes//bookingDeclarationRoute';
import projectRoute from './classes/routes//projectRoute';
import taskRoute from './classes/routes//taskRoute';
import timeEntries from './classes/routes//timeEntries';
import timeRecordRoutes from './classes/routes/timeRecordRoutes';
import { Logger } from './logger';
import { ISessionTimeEntry } from '../../common/typescript/iSessionTimeEntry';
import { v4 } from 'uuid';
import { FilterQuery } from 'mongodb';
import { DurationCalculator } from '../../common/typescript/helpers/durationCalculator';
import { Duration } from 'luxon';
import sessionTimeEntryRoute from './classes/routes/sessionTimeEntryRoute';

export interface IApp {
  configure(): void;
  configureExpress(): void;
  shutdown(): Promise<boolean>;
  configureRest(): void;
  setupDatabaseConnection(): void;
  closeDataBaseConnection(): Promise<void>;
}

// @ts-ignore
interface IUser extends Document<any> {
  username: string;
  hash: string;
}

export class App implements IApp {
  private readonly domain = process.env.DOMAIN;

  private readonly csp = "default-src "  + this.domain + ";frame-src " + this.domain + ";script-src-elem " + this.domain + ";script-src 'unsafe-inline';style-src 'self' 'unsafe-inline';font-src "+ this.domain + ";img-src " + this.domain + " data:;connect-src "  + this.domain + "";

  private readonly relativePathToAppJs = './../../../client/dist/mtt-client';

  private readonly pathStr = path.resolve(App.absolutePathToAppJs, this.relativePathToAppJs);;

  private express: Application;
  private server: Server;
  public static mongoDbOperations: MonogDbOperations;
  // static logger: Logger;
  static absolutePathToAppJs: string;
  static absolutePathToPrivateKey: string;
  static absolutePathToCert: string;

  private User: Model<IUser>;
  private sessionStore: MongoStore;

  private innerAuthentication(username: string, password: string, cb: (err: any, user?: any) => void) {
    this.User.findOne({ username: username })
      .then((user: IUser | null) => {

        if (!user) { return cb(null, false); }

        const isValid = this.validPassword(password, user.hash);

        if (isValid) {
          return cb(null, user);
        } else {
          return cb(null, false);
        }
      })
      .catch((err: any) => {
        cb(err);
      });
  }
  // }

  public constructor(port: number, hostname: string) {
    this.express = express();
    const key = readFileSync(App.absolutePathToPrivateKey);
    const cert = readFileSync(App.absolutePathToCert);
    const options: ServerOptions = {
      key: key,
      cert: cert
    };
    this.server = https.createServer(options, this.express);
    this.server.listen(port, hostname, () => {
      Logger.instance.info('successfully started on: ' + hostname + ':' + port);
    })
    // this.server = this.express.listen(port, hostname, () => {
    // });

    // set up express-session
    const completeDataBaseString = routesConfig.url + '/' + routesConfig.sessionsDataBaseName;
    const mogooseConnection: Connection = mongoose.createConnection(completeDataBaseString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // user: process.env.USER as string,
      // pass: process.env.PW as string
    });
    const UserSchema = new mongoose.Schema<IUser>({
      username: String,
      hash: String,
    });
    this.User = mogooseConnection.model<IUser>('User', UserSchema);

    // this.localStrategyHandler = new Strategy(
    //   (username, password, cb) => {
    //     this.innerAuthentication(username, password, cb);
    //   }
    // );
    const client = mogooseConnection.getClient();
    this.sessionStore = new MongoStore({ clientPromise: Promise.resolve(client) });
  }

  public static setAbsolutePathToAppJs(privateKeyRelativePath: string, certRelativePath: string) {
    App.absolutePathToAppJs = process.argv[1];
    App.absolutePathToPrivateKey = resolve(App.absolutePathToAppJs, privateKeyRelativePath);
    App.absolutePathToCert = resolve(App.absolutePathToAppJs, certRelativePath);

    // DEBUGGING
    // console.log(absolutePathToPrivateKey);
    // console.log(absolutePathToCert);
  }

  public static configureLogger(loggingFileName: string) {
    // const absolutePathToLoggingFolder: string = resolve(App.absolutePathToAppJs, relativePathToLoggingFolder);
    const absolutePathToLoggingFolder = '/var/log/time-tracker';
    if (!existsSync(absolutePathToLoggingFolder)) {
      mkdirSync(absolutePathToLoggingFolder);
    }
    const absolutePathToLoggingFile = resolve(absolutePathToLoggingFolder, loggingFileName);
    Logger.configureLogger(absolutePathToLoggingFile);
  }

  public setupDatabaseConnection() {
    App.mongoDbOperations = new MonogDbOperations();
    App.mongoDbOperations.prepareConnection();
  }

  public closeDataBaseConnection(): Promise<void> {
    const promiseOrNull = App.mongoDbOperations.closeConnection();
    if (promiseOrNull !== null) {
      return promiseOrNull;
    }
    return Promise.reject();
  }

  private validPassword(passwordHash: string, hash: string) {
    return hash === passwordHash;
  }

  // private localStrategyHandler: Strategy;

  private serializeUserHandler(user: Express.User, done: (err: any, id?: any) => void) {
    // Logger.instance.log(JSON.stringify(user, null, 4));
    done(null, (user as any)._id);
  }

  private deserializeUser(id: any, done: (err: any, user?: Express.User) => void) {
    this.User.findById(id, (err: any, user: Express.User) => {
      if (err) { return done(err); }
      done(null, user);
    });
  }

  public configure(): void {
    // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
    this.express.use(bodyParser.text());
    this.express.use(bodyParser.urlencoded({ extended: true }));
    this.express.use(helmet());

    const corsConfig: any = {
      origin: this.domain
    };

    this.express.use('/', cors(corsConfig), (req: Request, res: Response, next: NextFunction) => {
      // DEBUGGING:
      // Logger.instance.info('cors:' + req.url);

      // csp
      res.setHeader("Content-Security-Policy", this.csp);

      // Website you wish to allow to connect
      // res.setHeader('Access-Control-Allow-Origin', req.headers.origin ? req.headers.origin.toString() : '');
      res.setHeader('Access-Control-Allow-Origin', corsConfig.origin);

      // Request methods you wish to allow
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

      // Request headers you wish to allow
      res.setHeader('Access-Control-Allow-Headers', "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");

      // Set to true if you need the website to include cookies in the requests sent
      // to the API (e.g. in case you use sessions)
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if ("OPTIONS" == req.method) {
        // console.log('OPTIONS');
        next();
      } else {
        next();
      }
    });

    this.express.use('/', express.static(this.pathStr));

    // passport.use(this.localStrategyHandler);
    passport.serializeUser(this.serializeUserHandler.bind(this));
    passport.deserializeUser(this.deserializeUser.bind(this));

    const sessionHandler = session({
      genid: (req) => {
        // https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d
        // console.log('Inside the session middleware')
        // console.log(req.sessionID)
        Logger.instance.info("old session id:" + req.sessionID);
        const newSessionId = v4();
        Logger.instance.info("new sessionId:" + newSessionId);
        return newSessionId; // use UUIDs for session IDs
      },
      secret: routesConfig.secret,
      resave: false,
      saveUninitialized: true,
      store: this.sessionStore,
      cookie: {
        maxAge: 1000 * 60 * 60 * 14, // (1 day * 14 hr/1 day * 60 min/1 hr * 60 sec/1 min * 1000 ms / 1 sec)
      },
    });
    this.express.use(sessionHandler);
    const passportInitializeHandler = passport.initialize();
    this.express.use(passportInitializeHandler);
    const passportSessionHandler = passport.session();
    this.express.use(passportSessionHandler);
  }

  public configureExpress(): void {
    // https://medium.com/javascript-in-plain-english/excluding-routes-from-calling-express-middleware-with-express-unless-3389ab4117ef
    const ensureAuthenticatedHandler = (req: Request, res: Response, next: NextFunction) => {
      const allowedUrls = [
        '/',
        // '/styles',
        // '/runtime',
        // '/polyfills',
        // '/main',
        // '/scripts',
        // '/assets',
        // '/MaterialIcons-Regular',
        '/stopwatch-2-32.ico',
        '/favicon.ico',
        // '/api/',
        // '/vendor',
        '/' + routesConfig.viewsPrefix + 'login',
        '/api/login',
        '/api/login-status',
        '/api/logout'
      ];
      let isAllowed = false;
      allowedUrls.forEach((oneAllowedUrlPrefix: string) => {
        if (req.url === oneAllowedUrlPrefix) {
          isAllowed = true;
        }
      });
      // if (req.url === '/') {
      //   isAllowed = true;
      // }
      // DEBUGGING:
      // Logger.instance.info('isAllowed:' + isAllowed + '@' + req.url);

      if (isAllowed) {
        next();
      } else {
        if (req.isAuthenticated()) {
          // DEBUGGING:
          // Logger.instance.info('else-isAuthenticated:' + req.isAuthenticated() + '@' + req.url);
          next();
          return;
        }
        const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
        // const DEFAULT_NOT_AUTHENTICATED_MESSAGE = 'Authentication required';

        res.sendStatus(HTTP_STATUS_CODE_UNAUTHORIZED);
        // res.json({ message: DEFAULT_NOT_AUTHENTICATED_MESSAGE });
      }
    };
    this.express.use(ensureAuthenticatedHandler);
    this.express.post('/api/login', (req: Request, res: Response, next: NextFunction) => {
      // TODO: necessary ?
      // res.setHeader("Content-Security-Policy", this.csp);
      // res.setHeader('Access-Control-Allow-Credentials', 'true');

      const body = JSON.parse(req.body);

      this.innerAuthentication(body.username, body.password, (err: any, user?: any) => {
        if (err) {
          Logger.instance.error(JSON.stringify(err));
          next(err);
          return;
        }
        if (!user) {
          const noUserMsg = 'no user:' + JSON.stringify(user, null, 4);
          Logger.instance.error(noUserMsg);
          next(noUserMsg);
          return;
        }
        req.login(user, (errForLogin: any) => {
          if (errForLogin) {
            const errForLoginMsg = 'errorForLogging:' + JSON.stringify(errForLogin, null, 4);
            Logger.instance.error(errForLoginMsg);
            next(errForLoginMsg);
            return;
          }

          // DEBUGGING:
          Logger.instance.info('login was successful');
          var sessionIdAsTimeEntryId = req.sessionID;
          Logger.instance.info("sessionId in login-code:" + sessionIdAsTimeEntryId);
          // const reqMock: Request = {} as Request;
          // reqMock.body = {};
          var startTime = new Date();
          const sessionTimeEntry: ISessionTimeEntry = {
            startTime,
            timeEntryId: sessionIdAsTimeEntryId,
            day: DurationCalculator.getDayFrom(startTime)
          };
          App.mongoDbOperations.insertOne(sessionTimeEntry, routesConfig.sessionTimEntriesCollectionName);

          res.sendStatus(200);
        });
      });
    });
    this.express.get('/api/login-status', (req, res) => {
      // https://stackoverflow.com/questions/18739725/how-to-know-if-user-is-logged-in-with-passport-js
      req.isAuthenticated() ? res.status(200).send(JSON.stringify({ isLoggedIn: true })) : res.status(200).send(JSON.stringify({ isLoggedIn: false }));
    });

    // Visiting this route logs the user out
    this.express.post('/api/logout', (req, res, next) => {
      const sessionIdAsTimeEntryId = req.sessionID;

      req.logout();
      // https://stackoverflow.com/questions/50454992/req-session-destroy-and-passport-logout-arent-destroying-cookie-on-client-side
      req.session.destroy((destroyErr) => {
        res.clearCookie('connect.sid');
        // Don't redirect, just print text
        // res.send('Logged out');

        // perform sessionTimeEntry logic
        // DEBUGGING:
      Logger.instance.info('Logout was successful');
      
      Logger.instance.info("sessionId in logout-code:" + sessionIdAsTimeEntryId);

      const filterQuery: FilterQuery<any> =  {
        timeEntryId: sessionIdAsTimeEntryId
      };
      const sessionTimeEntryPromise = App.mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, filterQuery);
      sessionTimeEntryPromise.then((docs: ISessionTimeEntry[]) => {
          if (!docs || !docs.length) {
            return;
          }
          var endTime = new Date();
          var storedSessionTimeEntry = docs[0];
          var startTime = storedSessionTimeEntry.startTime;
          const calculatedMilliseconds = endTime.getTime() - startTime.getTime();
          let calculatedDuration = Duration.fromMillis(calculatedMilliseconds);
          calculatedDuration.shiftTo();
          storedSessionTimeEntry.endTime = endTime;
          storedSessionTimeEntry.durationInMilliseconds = calculatedDuration.toObject();
      
          var innerPromise = App.mongoDbOperations.updateOne("timeEntryId", sessionIdAsTimeEntryId, storedSessionTimeEntry, routesConfig.sessionTimEntriesCollectionName);
          innerPromise.then(() => {
            res.sendStatus(200);
          });
        });
      });
      // TODO: necessary ?
      // res.setHeader("Content-Security-Policy", this.csp);
      // res.setHeader('Access-Control-Allow-Credentials', 'true');

      // https://docs.mongodb.com/manual/tutorial/update-documents/
      // App.mongoDbOperations.updateOne("", currentSession.timeEntryId, updatedDocument, routesConfig.sessionTimEntriesCollectionName);
    });


    // https://stackoverflow.com/questions/25216761/express-js-redirect-to-default-page-instead-of-cannot-get
    // https://stackoverflow.com/questions/30546524/making-angular-routes-work-with-express-routes
    // https://stackoverflow.com/questions/26917424/angularjs-and-express-routing-404
    // https://stackoverflow.com/questions/26079611/node-js-typeerror-path-must-be-absolute-or-specify-root-to-res-sendfile-failed
    // necessary ?
    this.express.get('/' + routesConfig.viewsPrefix + '*', (request: Request, response: Response) => {
      // DEBUGGING:
      // Logger.instance.info('deliver view for:' + request.url);
      // Logger.instance.info(pathStr);

      // TODO: necessary?
      // response.setHeader("Content-Security-Policy", this.csp);

      response.sendFile('index.html', { root: this.pathStr });
    });
  }

  public configureRest() {
    // http://expressjs.com/de/api.html#router
    this.express.use(routesConfig.timeRecord, timeRecordRoutes);
    this.express.use(routesConfig.task, taskRoute);
    this.express.use(routesConfig.project, projectRoute);
    this.express.use(routesConfig.timeEntries, timeEntries);
    this.express.use(routesConfig.bookingDeclaration, bookingDeclarationRoute);
    this.express.use(routesConfig.sessionTimeEntry, sessionTimeEntryRoute);
  }

  public shutdown(): Promise<boolean> {
    return new Promise<boolean>((resolve: (value: boolean) => void, reject: (value: any) => void) => {
      // https://hackernoon.com/graceful-shutdown-in-nodejs-2f8f59d1c357
      this.server.close((err: Error | undefined) => {
        if (err) {
          Logger.instance.error('error when closing the http-server');
          // Logger.instance.error(err);
          // Logger.instance.error(JSON.stringify(err, null, 4));
          reject(err);
          return;
        }
        Logger.instance.error('http-server successfully closed');

        resolve(true);
      });
    });
  }
}

export default App;
