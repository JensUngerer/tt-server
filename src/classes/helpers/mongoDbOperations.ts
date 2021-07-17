import { MongoClient, Cursor, FilterQuery } from 'mongodb';
// @ts-ignore
import * as routes from '../../../../common/typescript/routes.js';
import { Logger } from './../../logger';

export class MonogDbOperations {
  private mongoClient: MongoClient | null = null;
  private databaseName: string | null = null;
  private url: string | null = null;
  private connection: Promise<MongoClient> | null = null;

  public prepareConnection() {
    this.url = routes.url;
    this.databaseName = routes.databaseName;

    this.mongoClient = new MongoClient(this.url as string, { useNewUrlParser: true, useUnifiedTopology: true });
    this.connection = this.mongoClient.connect();
  }

  public closeConnection(): Promise<void> | null {
    if (this.mongoClient === null) {
      Logger.instance.error('cannot close connection');
      return null;
    }
    return this.mongoClient.close();
  }

  // https://docs.mongodb.com/manual/tutorial/update-documents/
  public updateOne(idPropertyName: string, idPropertyValue: any, updatedDocumentEntry: any, collectionName: string) {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // Logger.instance.error('connectionSuccess');
        // Logger.instance.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);
        const filter: any = {};
        filter[idPropertyName] = idPropertyValue;
        const updateQuery: any = {};
        updateQuery.$set = {};
        for (const key in updatedDocumentEntry) {
          if (key === '_id')  {
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(updatedDocumentEntry, key)) {
            const element = updatedDocumentEntry[key];
            updateQuery.$set[key] = element;
          }
        }
        collection.updateOne(filter, updateQuery, (err: any, result: any) => {
          if (err) {
            Logger.instance.error('updateOne-MongoDb-operation failed');
            resolve(err);
            return;
          }

          resolve(result);
        });

        // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
        // const updateObj: any = { $set: {} };
        // updateObj.$set[propertyName] = propertyValue;

        // // DEBUGGING:
        // // Logger.instance.error('calling updateOne');
        // // Logger.instance.error(JSON.stringify({
        // //     queryObj,
        // //     updateObj
        // // }, null, 4));

        // collection.updateOne(queryObj, updateObj, (err: any, result: any) => {
        
        // });
      });
      this.connection.catch((connectionErr: any) => {
        Logger.instance.error('error when connecting to db');
        Logger.instance.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public patchPush(propertyName: string, propertyValue: any, collectionName: string, queryObj: FilterQuery<any>) {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // Logger.instance.error('connectionSuccess');
        // Logger.instance.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        const updateObj: any = { $push: {} };
        updateObj.$push[propertyName] = propertyValue;

        // // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/

        // // DEBUGGING:
        // Logger.instance.error(JSON.stringify({
        //     queryObj,
        //     updateObj
        // }, null, 4));

        collection.updateOne(queryObj, updateObj, (err: any, result: any) => {
          if (err) {
            Logger.instance.error('update failed');
            resolve(err);
            return;
          }

          resolve(result);
        });

      });
      this.connection.catch((connectionErr: any) => {
        Logger.instance.error('error when connecting to db');
        Logger.instance.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public patch(propertyName: string, propertyValue: any, collectionName: string, queryObj: FilterQuery<any>) {
    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // Logger.instance.error('connectionSuccess');
        // Logger.instance.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        // https://mongodb.github.io/node-mongodb-native/3.2/tutorials/crud/
        const updateObj: any = { $set: {} };
        updateObj.$set[propertyName] = propertyValue;

        // DEBUGGING:
        // Logger.instance.error('calling updateOne');
        // Logger.instance.error(JSON.stringify({
        //     queryObj,
        //     updateObj
        // }, null, 4));

        collection.updateOne(queryObj, updateObj, (err: any, result: any) => {
          if (err) {
            Logger.instance.error('update failed');
            resolve(err);
            return;
          }

          resolve(result);
        });
      });
      this.connection.catch((connectionErr: any) => {
        Logger.instance.error('error when connecting to db');
        Logger.instance.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public getFiltered(collectionName: string, queryObj?: FilterQuery<any>): Promise<any[]> {
    return new Promise<any>((resolve: (value: any[]) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // Logger.instance.error('connectionSuccess');
        // Logger.instance.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        const retrievedFilterQuery = queryObj ? queryObj : {};

        // DEBUGGING:
        // Logger.instance.error(JSON.stringify({
        //     collectionName,
        //     retrievedFilterQuery
        // }, null, 4));

        const cursor: Cursor<any> = collection.find(retrievedFilterQuery);
        if (!cursor) {
          Logger.instance.error('!cursor');
          resolve([]);
          this.mongoClient.close();
          return;
        }

        cursor.toArray().then((resolvedData: any[]) => {
          // DEBUGGING:
          // Logger.instance.error(JSON.stringify(resolvedData, null, 4));

          resolve(resolvedData);
        }).catch(() => {
          resolve([]);
        });
      });

      this.connection.catch((connectionErr: any) => {
        Logger.instance.error('error when connecting to db');
        Logger.instance.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }

  public insertOne(data: any, collectionName: string) {
    // https://mongodb.github.io/node-mongodb-native/
    // https://mongodb.github.io/node-mongodb-native/3.2/

    return new Promise<any>((resolve: (value: any) => void, reject: (value: any) => void) => {
      if (this.connection === null) {
        return;
      }
      this.connection.then((theMongoClient: any) => {
        if (this.mongoClient === null) {
          return;
        }
        // DEBUGGING:
        // Logger.instance.error('connectionSuccess');
        // Logger.instance.error(connectionSuccess);

        const db = this.mongoClient.db(this.databaseName as string);
        const collection = db.collection(collectionName);

        // DEBUGGING:
        // Logger.instance.info('insertOne');
        // Logger.instance.info(collectionName);
        // Logger.instance.info(JSON.stringify(data, null, 4));

        // should no longer be necessary as data _should_ not contain _id
        if (data && data._id) {
          Logger.instance.error('there is already an id -> returning');
          return;
        }

        collection.insertOne(data, (insertError: any, result: any) => {
          if (insertError) {
            resolve(insertError);
            return;
          }

          // DEBUGGING:
          // Logger.instance.info(JSON.stringify(result, null, 4));

          resolve(data);
          // this.mongoClient.close();
        });
      });

      this.connection.catch((connectionErr: any) => {
        Logger.instance.error('error when connecting to db');
        Logger.instance.error(connectionErr);
        resolve(connectionErr);
      });
    });
  }
}
