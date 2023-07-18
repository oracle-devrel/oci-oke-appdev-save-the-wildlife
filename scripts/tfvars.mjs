#!/usr/bin/env zx

import {
  getNamespace,
  getRegions,
  getTenancyId,
  searchCompartmentIdByName,
} from "./lib/oci.mjs";
import { setVariableFromEnvOrPrompt, exitWithError } from "./lib/utils.mjs";

const shell = process.env.SHELL | "/bin/zsh";
$.shell = shell;
$.verbose = false;

const { _ } = argv;
const [action] = _;

if (action === "env") {
  await envTFvars();
  process.exit(0);
}

if (action === "devops") {
  await devopsTFvars();
  process.exit(0);
}

console.log("Usage:");
console.log("\tnpx zx scripts/tfvars.mjs env");
console.log("\tnpx zx scripts/tfvars.mjs devops");

process.exit(0);

async function envTFvars() {
  const tenancyId = await getTenancyId();

  const regions = await getRegions();
  const regionName = await setVariableFromEnvOrPrompt(
    "OCI_REGION",
    "OCI Region name",
    async () => printRegionNames(regions)
  );

  const compartmentName = await setVariableFromEnvOrPrompt(
    "DEVOPS_COMPARTMENT_NAME",
    "DevOps Compartment Name (root)"
  );

  const compartmentId = await searchCompartmentIdByName(
    compartmentName || "root"
  );

  const onsEmail = await setVariableFromEnvOrPrompt(
    "ONS_EMAIL",
    "Oracle Notification Service (ONS) email"
  );

  const githubToken = await setVariableFromEnvOrPrompt(
    "GITHUB_TOKEN",
    "GitHub Token"
  );

  try {
    let { exitCode, stderr } =
      await $`sed 's/REGION_NAME/${regionName}/' deploy/devops/tf-env/terraform.tfvars.template \
                 | sed 's/TENANCY_OCID/${tenancyId}/' \
                 | sed 's/COMPARTMENT_OCID/${compartmentId}/' \
                 | sed 's/SUBSCRIPTION_EMAIL/${onsEmail}/' \
                 | sed 's/GITHUB_TOKEN/${githubToken}/' > deploy/devops/tf-env/terraform.tfvars`;
    if (exitCode !== 0) {
      exitWithError(
        `Error creating deploy/devops/tf-env/terraform.tfvars: ${stderr}`
      );
    }
    console.log(
      `${chalk.green("deploy/devops/tf-env/terraform.tfvars")} created.`
    );
  } catch (error) {
    exitWithError(error.stderr);
  }
}

async function devopsTFvars() {
  const tenancyId = await getTenancyId();

  const namespace = await getNamespace();

  const regions = await getRegions();
  const regionName = await setVariableFromEnvOrPrompt(
    "OCI_REGION",
    "OCI Region name",
    async () => printRegionNames(regions)
  );

  await cd("deploy/devops/tf-env");

  const { key } = regions.find((r) => r.name === regionName);
  const regionKey = key;

  const { stdout } = await $`terraform output -json`;
  const terraformOutput = JSON.parse(stdout);

  const values = {};
  for (const [key, content] of Object.entries(terraformOutput)) {
    values[key] = content.value;
  }

  const {
    compartment,
    deploy_id,
    devops_ons_topic_ocid: devopsOnsTopicId,
    github_access_token_secret_ocid: githubAccessTokenSecretId,
    oke_cluster_ocid: okeClusterId,
    user_name: userName,
    user_auth_token_id: userAuthTokenId,
    adb_admin_password_id: adbAdminPasswordId,
    adb_service: adbService,
    adb_id: adbId,
    redis_password_id: redisPasswordId,
  } = values;

  await cd("../../..");

  console.log(`Environment deployment id: ${deploy_id}`);

  const compartmentId = await searchCompartmentIdByName(compartment || "root");

  const githubURLParam = await setVariableFromEnvOrPrompt(
    "GITHUB_URL",
    "GitHub URL"
  );

  const githubURL = githubURLParam.endsWith(".git")
    ? githubURLParam.replace(".git", "")
    : githubURLParam;

  const githubUser = githubURL.split("/").reverse()[1];

  const githubURLEscaped = githubURL.replaceAll("/", "\\/");
  const replaceCmdURL = `s/GITHUB_REPOSITORY_URL/${githubURLEscaped}/`;

  try {
    let { exitCode, stderr } =
      await $`sed 's/REGION_NAME/${regionName}/' deploy/devops/tf-devops/terraform.tfvars.template \
           | sed 's/TENANCY_OCID/${tenancyId}/' \
           | sed 's/COMPARTMENT_OCID/${compartmentId}/' \
           | sed 's/NAMESPACE/${namespace}/' \
           | sed 's/REGION_KEY/${regionKey}/' \
           | sed 's/ONS_TOPIC_ID/${devopsOnsTopicId}/' \
           | sed 's/OKE_CLUSTER_ID/${okeClusterId}/' \
           | sed 's/OCIR_USER/${userName}/' \
           | sed 's/GITHUB_SECRET_OCID/${githubAccessTokenSecretId}/' \
           | sed 's/USER_AUTH_TOKEN_OCID/${userAuthTokenId}/' \
           | sed 's/ADB_ADMIN_PASSWORD_OCID/${adbAdminPasswordId}/' \
           | sed 's/ADB_SERVICE/${adbService}/' \
           | sed 's/ADB_OCID/${adbId}/' \
           | sed 's/REDIS_PASSWORD_OCID/${redisPasswordId}/' \
           | sed ${replaceCmdURL} \
           | sed 's/GITHUB_USER/${githubUser}/' > deploy/devops/tf-devops/terraform.tfvars`;
    if (exitCode !== 0) {
      exitWithError(
        `Error creating deploy/devops/tf-devops/terraform.tfvars: ${stderr}`
      );
    }
    console.log(
      `${chalk.green("deploy/devops/tf-devops/terraform.tfvars")} created.`
    );
  } catch (error) {
    exitWithError(error.stderr);
  }
}
