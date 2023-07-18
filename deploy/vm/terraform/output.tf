output "compute_web" {
    value = oci_core_instance.compute_web[0].public_ip
}
output "compute_server" {
    value = oci_core_instance.compute_server[0].public_ip
}

output "lb_public_ip" {
  value = oci_core_public_ip.public_reserved_ip.ip_address
}

# # Output the "list" of all availability domains.
# output "all-availability-domains-in-your-tenancy" {
#   value = data.oci_identity_availability_domains.ads.availability_domains
# }