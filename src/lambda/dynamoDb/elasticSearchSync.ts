import { DynamoDBStreamEvent, DynamoDBStreamHandler } from 'aws-lambda'
import 'source-map-support/register'
import * as elasticsearch from 'elasticsearch'
import * as httpAwsEs from 'http-aws-es'

const esHost = process.env.ES_ENDPOINT

const es = new elasticsearch.Client({
    hosts: [esHost],
    connectionClass: httpAwsEs
})

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
    console.log('Processing events batch from DynamoDB', JSON.stringify(event))

    // Iterate through the DynamoDBRecords
    for (const record of event.Records) {
        console.log('Processing record', JSON.stringify(record))

        // Only proces newly created items
        if (record.eventName !== 'INSERT') {
            continue
        }

        // Replicate the new item
        const newItem = record.dynamodb.NewImage
        const imageId = newItem.imageId.S
        const body = {
            imageId: newItem.imageId.S,
            groupId: newItem.groupId.S,
            imageUrl: newItem.imageUrl.S,
            title: newItem.title.S,
            timestamp: newItem.timestamp.S
        }

        // Add the item to ElasticSearch
        await es.index({
            index: 'images-index',
            type: 'images',
            id: imageId,
            body
        })
    }
}
