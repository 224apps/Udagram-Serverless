import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import 'source-map-support/register'
import * as AWS from 'aws-sdk'
import * as uuid from 'uuid'

const docClient = new AWS.DynamoDB.DocumentClient()

const s3 = new AWS.S3({
    signatureVersion: 'v4'
})

const groupsTable = process.env.GROUPS_TABLE
const imagesTable = process.env.IMAGES_TABLE
const bucketName = process.env.IMAGES_S3_BUCKET
const urlExpiration = parseFloat(process.env.SIGNED_URL_EXPIRATION)

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    console.log('Processing event:', event)

    const imageId = uuid.v4()
    const groupId = event.pathParameters.groupId  // .../groups/{groupId}/images/
    const parsedBody = JSON.parse(event.body)  // {title}
    const timestamp = new Date().toISOString()

    const url = getUploadUrl(imageId)

    // 1. check if the group exists
    const validGroupId = await groupExists(groupId)

    // 2. if not, return 404
    if (!validGroupId) {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Group does not exist'
            })
        }
    }

    // 3. else, post the image meta data
    const newImage = await postImageToGroup({
        imageId: imageId,
        groupId: groupId,
        title: parsedBody.title,
        timestamp: timestamp,
        imageUrl: `https://${bucketName}.s3.amazonaws.com/${imageId}`
    })

    // 4. return the new image
    return {
        statusCode: 201,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            newImage: newImage,
            uploadUrl: url
        })
    }
}

async function groupExists(groupId: string) {
    const result = await docClient
        .get({
            TableName: groupsTable,
            Key: {
                id: groupId
            }
        })
        .promise()

    console.log('Get group: ', result)
    return !!result.Item  // false if result == undefined
}

async function postImageToGroup(newImage) {
    await docClient.put({
        TableName: imagesTable,
        Item: newImage
    }).promise()
    return newImage
}

function getUploadUrl(imageId: string) {
    return s3.getSignedUrl('putObject', {
        Bucket: bucketName,
        Key: imageId,
        Expires: urlExpiration
    })
}