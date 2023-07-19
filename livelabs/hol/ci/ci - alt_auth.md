# Containerize and migrate to OCI Container Instances

## Introduction

In this lab, we will create container images for the application components and deploy them to the Container Instances service. Container Instances are an excellent tool for running containerized applications, without the need to manage any underlying infrastructure. Just deploy and go.

To help streamline the process, you'll use a custom script to create and publish container images to the OCI Container Registry. Container Registry makes it easy to store, share, and managed container images. Registries can be private (default) or public.

> **Note**: the instructions in this lab are designed around the Cloud Shell and utilize some of the built-in session variables. Should you choose to complete this outside of Cloud Shell, you will need to obtain these resource OCID's manually (through the OCI Panel or OCI CLI).

Estimated Lab Time: 15 minutes

![Container Instances](images/Container%20Service.png)

### Prerequisites

* An Oracle Free Tier or Paid Cloud Account

## Task 1: Configure Alternative CLI Authentication

While OCI Cloud Shell is pre-configured to authenticate us based on logged-on user credentials, it can be quite useful to understand how easy it is to leverage alternative authenticate methods. The following is also useful when leveraging the OCI CLI outside of Cloud Shell.

In this section, we will configure the CLI to an APIKey-based authentication.

1. Obtain our user's OCID - click the _Profile_ icon in the top right of the cloud console, then click on your username.

    ![Profile icon](images/get-user-id-01.png)

2. Copy your user OCID and store it in a text file.

    ![User OCID](images/get-user-id-02.png)


3. Now, we return to our Cloud Shell instance and retrieve the tenancy OCID. Copy it somewhere for now, like a text file.

    ```
    <copy>echo $OCI_TENANCY</copy>
    ```

4. Initiate CLI configuration by running:

    ```
    <copy>oci setup config</copy>
    ```


    ![CLI Setup Config](images/cli-config-01.png)

5. You will be prompted with a series of questions. When requested, enter your user OCID, your tenancy OCID, a profile name, and the name of the region you are using (a list will be presented for reference).

    ![Setup Config 2](images/cli-config-02.png)

    > **Note**: For this step, we have assigned a profile name of `workshop`. If you choose not to set a value, the value will be _`'DEFAULT'`_. The profile name is always stored in ALL CAPS and must be referenced accordingly.

6. When asked whether to create a new `API Signing RSA key pair`, type 'Y' and press enter, then continue pressing enter to accept all defaults.

7. Now, we can utilize OCI Cloud Shell's built-in authentication to upload the public portion of the API signing key to our user profile.

    ```
    <copy>oci iam user api-key upload --user-id <paste user OCID> --key-file ~/.oci/oci_api_key_public.pem</copy>
    ```

    ![API Key Upload](images/api-key-upload.png)

8. Now, we just have to test it out, by running the following command:

    ```
    <copy>oci iam availability-domain list --auth api_key --profile WORKSHOP --config-file ~/.oci/config</copy>
    ```

    > **Note**: The profile name you entered will automatically be converted to all CAPS. Make sure to do the same when you enter the CLI command.

9. You should see either 1 or 3 Availability Domains (ADs), depending on which region you're subscribed to in OCI. In this case, we have three ADs:

    ![CLI Test](images/cli-test.png)


## Task 2: Containerize the Application

In this task, you will create a container image for both the server and the web pieces of the application. The container images will be stored in the OCI Container Registry for deployment to Container Instances (and eventually OKE).

1. Generate an Auth Token for your Cloud user; this is required to authenticate to OCI Container Registry.

    ```
    <copy>oci iam auth-token create --description "DevLive-Workshop" --user-id <paste user OCID> --query 'data.token' --raw-output</copy>
    ```

2. Then, we copy the output string and store it somewhere safe. We will also create an environment variable to carry our auth token:

    ```
    <copy> export OCI_OCIR_TOKEN="<auth-token-here>"</copy>
    ```

    > **Note**: remove the `<>` when pasting your auth token.

3. We will also create an environment variable to hold our email address: 

    ```
    <copy>export OCI_OCIR_USER=<OCI_email_or_IAM_user_id></copy>
    ```

    ![Export variables](images/ocir-variables.png)

4. Making sure that we're in the right directory (`devlive-save-the-wildlife`) before we do anything else, let's execute:

    ```
    <copy>cd ~/devlive-save-the-wildlife</copy>
    ```

5. Then, we run the _`npx`_ script to set the environment. This script will:

    * Check dependencies on the environment

    * Create self-signed certificates, if necessary

    * Log into the container registry to validate credentials

    * Print component versions

    ```
    <copy>npx zx scripts/setenv.mjs</copy>
    ```

6. We then create and publish the **`server`** container image by executing the following command:

    ```
    <copy>npx zx scripts/release.mjs server</copy>
    ```

7. After the server container image has been published, we will copy the `Released:` path (which we can find at the above command's output) and store it in a text document.

    ![Server release path](images/release-server-01.png)

8. And now, we repeat the same process, but the purpose now is to create and publish the **`web`** container image as well:

    ```
    <copy>npx zx scripts/release.mjs web</copy>
    ```

9. Finally, we repeat step 7 and copy the `Released:` path and save it in a text document for now.


## Task 3: Deploy to Container Instances

Now that both images have been created and published, we just need to grab just a few more pieces of information and launch the Container Instances resource.

> **Note**: If you are using a custom compartment for the workshop (not the root compartment) make sure to replace any occurrence of `$OCI_TENANCY` with the full compartment OCID.

1. You may either navigate the OCI console to locate the OCID of your subnet or run the following CLI command. Copy the Subnet OCID to a text file.

    ```
    <copy>oci network subnet list -c $OCI_TENANCY --display-name "multiplayer public subnet" --query 'data[0].id' --raw-output</copy>
    ```

    > **Note**: if you aren't working within your tenancy's root compartment, replace the `$OCI_TENANCY` environment variable with the compartment OCID that you're using.

2. Retrieve the Availability Domain (AD) name and copy it to a text file.

    ```
    <copy>oci iam availability-domain list --query 'data[?contains ("name",`AD-1`)]|[0].name' --raw-output</copy>
    ```

3. Retrieve the OCI Object Storage namespace. This is required when logging in with a federated user (default for `Always Free` accounts).

    ```
    <copy>oci os ns get -c $OCI_TENANCY --query 'data' --raw-output</copy>
    ```

    ![Get OS Namespace](images/get-os-namespace.png)

4. Finally - you'll need to convert your OCIR username and auth token/password to _base64_ format, as required by the CLI. For that, depending on your account's authentication status (federated user or IAM user), here are the commands required to achieve this conversion: 

    - For federated users (you'll most likely be in this group):

        ```
        <copy>
        echo -n '<os namespace>/<username>' | base64
        echo -n '<auth token>' | base64
        </copy>
        ```

        Here's an example of running the conversion:

        ![Federated users](images/base64-federated.png)

    - For IAM users:

        ```
        <copy>
        echo -n '<tenancy name>/username>' | base64
        echo -n '<auth token>' | base64
        </copy>
        ```

    And remember to copy the newly generated base64-formatted values to a text file.

    > **Note**: if the **base64** output produces a new line or a carriage return character after the username, simply paste the output into a text file and strip it from these special characters.

5. Copy the following command to a text file, modify the <placeholder> values, then paste the full, edited command into your Cloud Shell instance:

    ```
    <copy>oci container-instances container-instance create --display-name oci-MultiPlayer \
    --availability-domain <AD Name> --compartment-id <Compartment OCID> \
    --containers ['{"displayName":"ServerContainer","imageUrl":"<release path for server image>","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}},{"displayName":"WebContainer","imageUrl":"<release path for Web image>","resourceConfig":{"memoryLimitInGBs":8,"vcpusLimit":1.5}}'] \
    --shape CI.Standard.E4.Flex --shape-config '{"memoryInGBs":16,"ocpus":4}' \
    --vnics ['{"displayName": "ocimultiplayer","subnetId":"<subnet OCID>"}'] \
    --image-pull-secrets ['{"password":"<base-64-encoded-auth-token>","registryEndpoint":"<OCIR endpoint>","secretType":"BASIC","username":"<base-64-encoded-username>"}'] \
    --config-file ~/.oci/config --profile WORKSHOP --auth api_key</copy>
    ```

   The command will look something like this (notice we created variables for a few of the parameter values - totally optional):

    Here's a breakdown of the command:
    - _oci container-instances container-instance create_ - This is the core cli command with the service name, service component, and action to take `create`.   
    - _--display-name_ oci-MultiPlayer - This is the display name for the container instance.  
    - _--availability-domain_ <AD Name> - This specifies the availability domain in which to create the container instance.
    - _--compartment-id_ <Compartment OCID> - This specifies the compartment in which the container instance will be created.
    - _--containers_ - This specifies the containers to be created within the container instance. This is an array of JSON objects, with each object representing a container. In this case, there are two containers: one for the server and one for the web application.
    - _--shape_ CI.Standard.E4.Flex - This specifies the shape of the container instance.
    - _--shape-config_ '{"memoryInGBs":16,"ocpus":4}' - This specifies the shape configuration for the container instance.
    - _--vnics_ - This specifies the virtual network interfaces to be attached to the container instance. This is an array of JSON objects, with each object representing a virtual network interface.
    - _--image-pull-secrets_ - This specifies the image-pull secrets to be used by the container instance. This is an array of JSON objects, with each object representing an image pull secret. The username and password must be **base64** encoded
    - _--config-file_ ~/.oci/config - This specifies the configuration file to be used for the OCI CLI.
    - _--profile_ WORKSHOP - This specifies the OCI CLI profile to use.
    - _--auth api key_ - This specifies the authentication method to be used for the OCI CLI.


        ![Create Container Instance](images/cli-create-CI.png)

6. In the Web UI, you can navigate to **`Developer Services`** -> `Container Instances` to watch the progress of the deployment. Observe when the two containers move to an Active state.

    ![CI Related Containers](images/ContainerInstance-containers.png)

7. Locate the private IP address for your Container Instance:

    ![CI Private IP](images/ContainerInstance-privateIp.png)

## Task 4: Modify the Load Balancer

In this fourth and final task, we need to add the Container Instance private IP address to the *backend set* of our Load Balancer (which was deployed as part of the first lab).

1. Create an environment variable for the private IP address of your Container Instance:

    ```
    <copy>export ciPrivIp="<paste ip here>"</copy>
    ```

2. Locate the OCID for the Load Balancer that was created in Lab 1. It should be named **`LB Multiplayer`**:

    ```
    <copy>lbOcid=($(oci lb load-balancer list -c $OCI_TENANCY --display-name "LB Multiplayer" --query 'data[0].id' --raw-output))</copy>
    ```

    > **Note**: Make sure to replace `$OCI_TENANCY` with the compartment OCID if you are not using the root compartment.

3. Run the following commands:

    ```
    <copy>
    #Retrieve the existing load balancer backends:
    serverBeName=($(oci lb backend list --backend-set-name lb-backend-set-server --load-balancer-id $lbOcid --query 'data[0].name' --raw-output))
    webBeName=($(oci lb backend list --backend-set-name lb-backend-set-web --load-balancer-id $lbOcid --query 'data[0].name' --raw-output))

    # Delete the existing load balancer backends:
    oci lb backend delete --backend-name $serverBeName --backend-set-name lb-backend-set-server --load-balancer-id $lbOcid --force
    oci lb backend delete --backend-name $webBeName --backend-set-name lb-backend-set-web --load-balancer-id $lbOcid --force

    #Create new backends for the Container Instance resource:
    oci lb backend create --backend-set-name lb-backend-set-server --ip-address $ciPrivIp --port 3000 --load-balancer-id $lbOcid
    oci lb backend create --backend-set-name lb-backend-set-web --ip-address $ciPrivIp --port 80 --load-balancer-id $lbOcid
    </copy>
    ```

4. Check the status of your Load Balancer and proceed when you see the **OK** status.

    ```
    <copy>oci lb load-balancer-health get --load-balancer-id $lbOcid</copy>
    ```

    ![LB Status Check](images/lb-status-check.png)

5. Once you see the **OK** status, you can navigate to the load balancer public IP in your browser (return to the tab from lab one and refresh, or open a new window).

    ```
    <copy>oci lb load-balancer get --load-balancer-id $lbOcid --query 'data."ip-addresses"[0]."ip-address"' --raw-output</copy>
    ```



## Acknowledgements

* **Author** - Victor Martin - Technology Product Strategy Director - EMEA
* **Author** - Wojciech (Vojtech) Pluta - Developer Relations - Immersive Technology Lead
* **Author** - Eli Schilling - Developer Advocate - Cloud Native and DevOps
* **Last Updated By/Date** - May, 2023
