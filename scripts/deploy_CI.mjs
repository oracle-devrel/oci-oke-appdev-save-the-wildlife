#!/usr/bin/env zx

import { exitWithError, readEnvJson } from "./lib/utils.mjs";
import { getVersionGradle } from "./lib/gradle.mjs";
import { downloadAdbWallet, listAdbDatabases } from "./lib/oci.mjs";

const shell = process.env.SHELL | "/bin/zsh";
$.shell = shell;
$.verbose = false;

// Read the environment variables from the JSON file written by setenv
const properties = await readEnvJson();
// Destructure out the variables you need
const {
  containerRegistryURL,
  containerRegistryUser,
  containerRegistryToken,
  namespace,
  regionKey,
} = properties;

// Prompt the user for the display name
const displayName = await question('Please enter the display name: ');
const availabilityDomain = await question('Please enter the availability domain: (KBpp:UK-LONDON-1-AD-1)');
const registryEndpoint = await question('Please enter the registry endpoint: (phx.ocir.io)');
const CompartmentId = await question('Please enter the add compartment ID');

const user = Buffer.from(containerRegistryUser).toString('base64');
const token = Buffer.from(containerRegistryToken).toString('base64');

console.log(
  `Preparing deployment for ${chalk.yellow(
    containerRegistryURL
  )} in namespace ${chalk.yellow(namespace)}`
);

// Create shell command
const command = `oci container-instances container-instance create --display-name ${displayName} \
    --availability-domain ${availabilityDomain} --compartment-id ${CompartmentId} \
    --containers ['{"displayName":"ServerContainer","imageUrl":${containerRegistryURL}"/server:1.0.0","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}},{"displayName":"WebContainer","imageUrl":${containerRegistryURL}/web:1.0.0","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}}'] --shape CI.Standard.E4.Flex --shape-config '{"memoryInGBs":16,"ocpus":4}'
    --vnics ['{"displayName": "multiplayer vcn","subnetId":"ocid1.subnet.oc1.uk-london-1.aaaaaaaanlmpugnpbd3hzo6iflracn62ytbdq4cqgc7d7f473vntbquhlxaq"}'] \
    --image-pull-secrets ['{"password":${user},"registryEndpoint":${registryEndpoint},"secretType":"BASIC","username":${token}}'] ` ;

// Print command
console.log(`Executing command: ${command}`);

// Execute command
const { stdout, stderr } = await $`${command}`;

if (stderr) {
    console.error(`Error: ${stderr}`);
    process.exit(1);
}

console.log(`stdout: ${stdout}`);