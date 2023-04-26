# Virtual Machine Deployment

## Set Up

Clone this repository in your local machine:

```bash
git clone https://github.com/vmleon/oci-multiplayer.git
```

Change directory to the `oci-multiplayer`:

```bash
cd oci-multiplayer
```

## Build and Deployment

Change to directory `deploy/vm/terraform`:

```bash
cd deploy/vm/terraform
```

Copy the template for the terraform variables:

```bash
cp terraform.tfvars.template terraform.tfvars
```

Edit the variables values:

```bash
vim terraform.tfvars
```

You have to modify:

- `tenancy_ocid` from your OCI tenancy
- `compartment_ocid` the compartment you want, or root compartment (that is the `tenancy_ocid`)
- `ssh_public_key` with your public SSH key, usually in `~/.ssh/id_rsa.pub`

Run the script:

```bash
./start.sh
```

The final output will show the Public IPs.

Copy and paste the `lb_public_ip` IP address on your browser.

## Clean Up

Destroy all the infrastructure:

```bash
./stop.sh
```
