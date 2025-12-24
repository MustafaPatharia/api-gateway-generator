const versionFilePath = './version.txt';

const servicesConfigWithProxy = {
  "test": { "port": 3000, "authorization": true },
};

const servicesConfigWithoutProxy = {
  "index.html": { "port": 3000, "authorization": false },
};


// Function to configure environment variables
function configureEnvironment(environment) {
  let USER_POOL, TITLE, AWS_URL, API_URL, REGION, ACCOUNT_ID;

  if (environment === 'Development') {
    USER_POOL = process.env.DEV_USER_POOL;
    TITLE = 'example-api-name';
    API_URL =  process.env.DEV_API_URL;
    AWS_URL = process.env.DEV_API_GATEWAY_URL;
    REGION = process.env.DEV_API_GATEWAY_REGION;
    ACCOUNT_ID = process.env.DEV_ACCOUNT_ID;
  } else {
    throw new Error('Invalid environment selected');
  }

  return { USER_POOL, TITLE, AWS_URL, API_URL, REGION, ACCOUNT_ID };
}

const fs = require('fs');
const { APIGatewayClient, GetRestApisCommand, CreateDeploymentCommand, GetStagesCommand, PutRestApiCommand } = require('@aws-sdk/client-api-gateway');
const inquirer = require('inquirer');
require('dotenv').config();

function createApiGatewayClient(region) {
  return new APIGatewayClient({
    region: region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

async function getAvailableApiGateways(client) {
  try {
    const command = new GetRestApisCommand({});
    const response = await client.send(command);
    return response.items || [];
  } catch (error) {
    console.error('Error fetching APIs:', error);
    throw error;
  }
}

async function getAvailableStages(client, apiId) {
  try {
    const command = new GetStagesCommand({ restApiId: apiId });
    const response = await client.send(command);
    return response.item || [];
  } catch (error) {
    console.error('Error fetching stages:', error);
    throw error;
  }
}

async function importApi(client, apiId, swaggerBody) {
  try {
    // Convert the swagger body to a properly formatted buffer
    const bodyBuffer = Buffer.from(JSON.stringify(swaggerBody), 'utf-8');

    const command = new PutRestApiCommand({
      restApiId: apiId,
      mode: 'overwrite', // This replaces the entire API
      body: bodyBuffer,
      failOnWarnings: false,
    });

    const response = await client.send(command);
    console.log('✅ API imported/updated successfully!');
    return response;
  } catch (error) {
    console.error('❌ Error importing API:', error.message);
    if (error.$metadata) {
      console.error('🔍 Request ID:', error.$metadata.requestId);
      console.error('🔍 HTTP Status:', error.$metadata.httpStatusCode);
    }
    throw error;
  }
}

async function deployApi(client, apiId, stageName) {
  try {
    const command = new CreateDeploymentCommand({
      restApiId: apiId, // Fixed: should be restApiId, not ApiId
      stageName: stageName, // Fixed: should be stageName, not StageName
    });

    const response = await client.send(command);
    console.log(`✅ API deployed successfully to stage ${stageName}`);
    return response;
  } catch (error) {
    console.error('❌ Error deploying API:', error.message);
    if (error.$metadata) {
      console.error('🔍 Request ID:', error.$metadata.requestId);
      console.error('🔍 HTTP Status:', error.$metadata.httpStatusCode);
    }
    throw error;
  }
}

// Original path generation functions (unchanged)
const getOptionsMethod = (config) => {
  return {
    "options": {
      "parameters": [
        ...(config.proxy ? [{
          "name": "proxy",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }] : [])
      ],
      "responses": {
        "200": {
          "description": "200 response",
          "headers": {
            "Access-Control-Allow-Origin": {
              "schema": {
                "type": "string"
              }
            },
            "Access-Control-Allow-Methods": {
              "schema": {
                "type": "string"
              }
            },
            "Access-Control-Allow-Headers": {
              "schema": {
                "type": "string"
              }
            }
          },
          "content": {}
        }
      },
      "x-amazon-apigateway-integration": {
        "responses": {
          "default": {
            "statusCode": "200",
            "responseParameters": {
              "method.response.header.Access-Control-Allow-Methods": "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'",
              "method.response.header.Access-Control-Allow-Headers": "'*'",
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            }
          }
        },
        "requestTemplates": {
          "application/json": "{\"statusCode\": 200}"
        },
        "passthroughBehavior": "when_no_match",
        "type": "mock"
      }
    }
  }
}

const httpResponses = [200];
const allPaths = {};

function generateIntegrationResponses(responseCodes) {
  const integrationResponses = {};
  responseCodes.forEach(responseCode => {
    integrationResponses[responseCode] = {
      statusCode: responseCode
    };
  });
  return integrationResponses;
}

function readVersion() {
  try {
    if (!fs.existsSync(versionFilePath)) {
      const defaultVersion = '1.0.0';
      fs.writeFileSync(versionFilePath, defaultVersion, 'utf-8');
      return defaultVersion;
    }
    const version = fs.readFileSync(versionFilePath, 'utf-8').trim();
    return version;
  } catch (err) {
    console.error('Error reading the version file:', err);
    return '1.0.0';
  }
}

function incrementVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] += 1;
  if (parts[2] > 99) {
    parts[2] = 0;
    parts[1] += 1;
  }
  if (parts[1] > 99) {
    parts[1] = 0;
    parts[0] += 1;
  }
  return parts.join('.');
}

const pathGeneration = (service, config) => {
  const basePath = config.proxy ? `/${service}/{proxy+}` : `/${service}`;
  const methods = {
    ...(getOptionsMethod(config)),
    "x-amazon-apigateway-any-method": {
      "parameters": [
        ...(config.proxy ? [{
          "name": "proxy",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string"
          }
        }] : []),
        {
          "name": "client",
          "in": "header",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ],
      "x-amazon-apigateway-integration": {
        "type": "http_proxy",
        "httpMethod": "ANY",
        "uri": `${config.AWS_URL}:${config.port}/${service}${config.proxy ? "/{proxy}" : ""}`,
        "responses": generateIntegrationResponses(httpResponses),
        "requestParameters": {
          ...(config.proxy ? { "integration.request.path.proxy": "method.request.path.proxy" } : {}),
          "integration.request.header.client": "method.request.header.client"
        },
        "passthroughBehavior": "when_no_match"
      }
    }
  };

  if (config.authorization) {
    methods["x-amazon-apigateway-any-method"]["security"] = [{
      "non-prod-authorization": []
    }];
  }

  allPaths[basePath] = methods;
}

// Main function to handle the process
async function main() {
  try {
    // Prompt for environment
    const { environment } = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message: 'Select the environment:',
        choices: ['Development']
      }
    ]);

    // Configure environment
    const { USER_POOL, TITLE, AWS_URL, REGION, ACCOUNT_ID } = configureEnvironment(environment);

    // Generate paths
    const currentVersion = readVersion();
    const newVersion = incrementVersion(currentVersion);
    fs.writeFileSync(versionFilePath, newVersion, 'utf-8');

    Object.entries(servicesConfigWithoutProxy).forEach(([service, config]) => {
      pathGeneration(service, { ...config, proxy: false, AWS_URL });
    });

    Object.entries(servicesConfigWithProxy).forEach(([service, config]) => {
      pathGeneration(service, { ...config, proxy: true, AWS_URL });
    });

    // Create OpenAPI structure
    const openApiStructure = {
      "openapi": "3.0.0",
      "info": {
        "title": TITLE,
        "version": newVersion
      },
      "paths": allPaths,
      "components": {
        "securitySchemes": {
          "non-prod-authorization": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "x-amazon-apigateway-authtype": "cognito_user_pools",
            "x-amazon-apigateway-authorizer": {
              "providerARNs": [`arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL}`],
              "type": "cognito_user_pools"
            }
          }
        }
      }
    };

    // Write Swagger file
    const outputFilePath = `Open_API_AWS_Gateway_${environment}.json`;
    const outputJSON = JSON.stringify(openApiStructure, null, 2);

    fs.writeFile(outputFilePath, outputJSON, async (err) => {
      if (err) {
        console.error('Error writing to the file:', err);
        return;
      }

      console.debug(`Output has been saved to ${outputFilePath}`);

      try {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Download file or upload to API Gateway?',
            choices: ['Download', 'Upload'],
          },
        ]);

        if (action === 'Download') {
          console.debug('File ready for download.');
          return;
        }

        const client = createApiGatewayClient(REGION);

        const apis = await getAvailableApiGateways(client);
        const { selectedApi } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedApi',
            message: 'Select an API Gateway:',
            choices: apis.map((api) => ({
              name: `${api.name} (${api.id})`,
              value: api,
            })),
          },
        ]);

        const stages = await getAvailableStages(client, selectedApi.id);
        const { selectedStage } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedStage',
            message: 'Select a stage:',
            choices: stages.map((stage) => stage.stageName),
          },
        ]);

        await importApi(client, selectedApi.id, openApiStructure);
        await deployApi(client, selectedApi.id, selectedStage);

        console.debug('Deployment completed successfully!');

      } catch (error) {
        console.error('An error occurred during deployment:', error);
      }
    });
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Execute the main function
main();