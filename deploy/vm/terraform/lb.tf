resource "oci_core_public_ip" "public_reserved_ip" {
  compartment_id = var.compartment_ocid
  lifetime       = "RESERVED"

  lifecycle {
    ignore_changes = [private_ip_id]
  }
}

variable "load_balancer_shape_details_maximum_bandwidth_in_mbps" {
  default = 10
}

variable "load_balancer_shape_details_minimum_bandwidth_in_mbps" {
  default = 10
}

resource "oci_load_balancer" "lb" {
  shape          = "flexible"
  compartment_id = var.compartment_ocid

  subnet_ids = [oci_core_subnet.publicsubnet.id]

  shape_details {
    maximum_bandwidth_in_mbps = var.load_balancer_shape_details_maximum_bandwidth_in_mbps
    minimum_bandwidth_in_mbps = var.load_balancer_shape_details_minimum_bandwidth_in_mbps
  }

  display_name = "LB Multiplayer"

  reserved_ips {
    id = oci_core_public_ip.public_reserved_ip.id
  }
}

resource "oci_load_balancer_backend_set" "lb-backend-set-web" {
  name             = "lb-backend-set-web"
  load_balancer_id = oci_load_balancer.lb.id
  policy           = "ROUND_ROBIN"

  health_checker {
    port                = "80"
    protocol            = "HTTP"
    url_path            = "/"
  }
}

resource "oci_load_balancer_backend_set" "lb-backend-set-server" {
  name             = "lb-backend-set-server"
  load_balancer_id = oci_load_balancer.lb.id
  policy           = "IP_HASH"

  health_checker {
    port                = "3000"
    protocol            = "TCP"
  }
}

resource "oci_load_balancer_listener" "lb-listener" {
  load_balancer_id         = oci_load_balancer.lb.id
  name                     = "http"
  default_backend_set_name = oci_load_balancer_backend_set.lb-backend-set-web.name
  port           = 80
  protocol       = "HTTP"
  routing_policy_name      = oci_load_balancer_load_balancer_routing_policy.routing_policy.name

  connection_configuration {
    idle_timeout_in_seconds = "2"
  }
}

resource "oci_load_balancer_backend" "lb-backend-web" {
  load_balancer_id = oci_load_balancer.lb.id
  backendset_name  = oci_load_balancer_backend_set.lb-backend-set-web.name
  ip_address       = oci_core_instance.compute_web[0].private_ip
  port             = 80
  backup           = false
  drain            = false
  offline          = false
  weight           = 1
}
resource "oci_load_balancer_backend" "lb-backend-server" {
  load_balancer_id = oci_load_balancer.lb.id
  backendset_name  = oci_load_balancer_backend_set.lb-backend-set-server.name
  ip_address       = oci_core_instance.compute_server[0].private_ip
  port             = 3000
  backup           = false
  drain            = false
  offline          = false
  weight           = 1
}

resource "oci_load_balancer_load_balancer_routing_policy" "routing_policy" {
  condition_language_version = "V1"
  load_balancer_id = oci_load_balancer.lb.id
  name = "routing_policy"
  
  rules {
    name = "routing_to_backend"
    condition = "any(http.request.url.path sw (i '/socket.io'))"
    actions {
      name = "FORWARD_TO_BACKENDSET"
      backend_set_name = oci_load_balancer_backend_set.lb-backend-set-server.name
    }
  }

  rules {
    name = "routing_to_frontend"
    condition = "any(http.request.url.path eq (i '/'))"
    actions {
      name = "FORWARD_TO_BACKENDSET"
      backend_set_name = oci_load_balancer_backend_set.lb-backend-set-web.name
    }
  }
}
