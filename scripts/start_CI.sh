#!/bin/bash

# Prompt the user for inputs
read -p "Enter the display name for the container instance: " DISPLAY_NAME
read -p "Enter the OCID of the compartment: " COMPARTMENT_OCID
read -p "Enter the OCID of the availability domain: " AD_OCID
read -p "Enter the OCID of the subnet: " SUBNET_OCID
read -p "Enter the OCI Registry username: " REGISTRY_USERNAME
read -p "Enter the OCI Registry password: " REGISTRY_PASSWORD
read -p "Enter the container image URL for the ServerContainer (default: phx.ocir.io/axywji1aljc2/oci_multiplayer/server:0.0.5): " SERVER_IMAGE_URL
SERVER_IMAGE_URL=${SERVER_IMAGE_URL:-"phx.ocir.io/axywji1aljc2/oci_multiplayer/server:0.0.5"}
read -p "Enter the container image URL for the WebContainer (default: phx.ocir.io/axywji1aljc2/oci_multiplayer/web:0.0.4): " WEB_IMAGE_URL
WEB_IMAGE_URL=${WEB_IMAGE_URL:-"phx.ocir.io/axywji1aljc2/oci_multiplayer/web:0.0.4"}
read -p "Enter the OCI profile to use (default: CI): " OCI_PROFILE
OCI_PROFILE=${OCI_PROFILE:-"CI"}

# TODO Investigate SUBNETOCID // Create the container instance
oci container-instances container-instance create \
  --display-name $DISPLAY_NAME \
  --availability-domain $AD_OCID \
  --compartment-id $COMPARTMENT_OCID \
  --containers '[{"displayName":"ServerContainer","imageUrl":"'$SERVER_IMAGE_URL'","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}},{"displayName":"WebContainer","imageUrl":"'$WEB_IMAGE_URL'","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}}]' \
  --shape CI.Standard.E4.Flex \
  --shape-config '{"memoryInGBs":16,"ocpus":4}' \
  --vnics '[{"displayName": "ocimultiplayer","subnetId":"'$SUBNET_OCID'"}]' \
  --image-pull-secrets '[{"password":"'$REGISTRY_PASSWORD'","registryEndpoint":"phx.ocir.io","secretType":"BASIC","username":"'$REGISTRY_USERNAME'"}]' \
  --config-file ~/.oci/config --profile $OCI_PROFILE --auth api_key
