import { FilterQuery } from "mongodb";
import { MonogDbOperations } from "../helpers/mongoDbOperations";
// import { SessionTimeEntryDocument } from './../../../../common/typescript/mongoDB/iSessionTimeEntryDocument";
import { ISessionTimeEntryDocument } from './../../../../common/typescript/mongoDB/iSessionTimeEntryDocument';

// @ts-ignore
import routesConfig from './..&../../../../../../common/typescript/routes.js';
import { Duration, DurationObject } from "luxon";
import { Logger } from "../../logger";

export default {
    getDurationStr(timeEntryId: string, mongoDbOperations: MonogDbOperations) {
        const queryObj: FilterQuery<any> = {};
        queryObj[routesConfig.timeEntryIdProperty] = timeEntryId;
        const timeEntriesPromise = mongoDbOperations.getFiltered(routesConfig.sessionTimEntriesCollectionName, queryObj);

        return new Promise<string>((resolve: (value: string) => void) => {
            timeEntriesPromise.then((sessionTimeEntryDocs: ISessionTimeEntryDocument[]) => {
                if (!sessionTimeEntryDocs ||
                    !sessionTimeEntryDocs.length) {
                    resolve('');
                    return;
                }
                const firstAndSingleDocument = sessionTimeEntryDocs[0];
                const storedDuration = firstAndSingleDocument.durationInMilliseconds as DurationObject;
                if (storedDuration) {
                    const duration = Duration.fromObject(storedDuration);
                    const durationStr = duration.toFormat('hh:mm:ss');
                    resolve(durationStr);
                } else {
                    const endTime = new Date();
                    const startTime = firstAndSingleDocument.startTime;
                    const timeSpanInMilliseconds = endTime.getTime() - startTime.getTime();
                    const duration = Duration.fromMillis(timeSpanInMilliseconds);
                    const durationStr = duration.toFormat('hh:mm:ss');
                    resolve(durationStr);
                }
            });
            timeEntriesPromise.catch((err: any) => {
                Logger.instance.error(err);
                resolve('00:00:00');
            });
        });
    }
}