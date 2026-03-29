import logging
import time

from pyisckea import Kea

from app.core.config import settings

URIS = {
    "v4": settings.KEA_DHCP4_URI if settings.KEA_DHCP4_URI else "",
    "v6": settings.KEA_DHCP6_URI if settings.KEA_DHCP6_URI else ""
}

logger = logging.getLogger(__name__)


class KeaDHCPServer():
    _v4_client = Kea(URIS["v4"])
    _v6_client = Kea(URIS["v6"])

    def get_v4_leases(self):
        return self._v4_client.dhcp4.lease4_get_all()

    def get_v6_leases(self):
        return self._v6_client.dhcp6.lease6_get_all()

    def get_subnet_ids(self):
        """
        Returns subnet IDs for both IPv4 and IPv6 subnets
        """
        v4 = self._v4_client.dhcp4.subnet4_list()
        v6 = self._v4_client.dhcp6.subnet6_list()
        return [net.id for net in v4+v6 if net.id]

    def get_summary(self):
        # In frontend: Saves to nmsdata.dhcpsummary, see nms-dhcp.js
        v4 = self.get_v4_leases()
        v6 = self.get_v6_leases()

        unique_v4 = len(set([lease.ip_address for lease in v4]))
        unique_v6 = len(set([lease.ip_address for lease in v6]))

        # Return object should match format expected by frontend:
        # {
        #   "dhcp": {
        #     4: unique ipv4 leases (int),
        #     6: unique ipv6 leases (int),
        #   }
        # }
        return {"dhcp": {4: unique_v4, 6: unique_v6}}

    def get_details(self):
        # In frontend: Saves to nmsdata.dhcp, see nms-map-handlers.js, function dhcpUpdater and dhcpInfo
        v4_leases = [lease for lease in self.get_v4_leases()
                     if lease.subnet_id]
        v6_leases = [lease for lease in self.get_v6_leases()
                     if lease.subnet_id]
        subnet_ids = self.get_subnet_ids()

        # When this data collection has occurred
        now: int = round(time.time())

        # Key: Subnet ID as defined by Kea
        # Value: Amount of leases belonging to that subnet
        subnet_lease_counts: dict[int, int] = {}

        # Key: Subnet ID as defined by Kea
        # Value: Unix timestamp to the last time this was updated
        # Note: A subnet not being defined as a key in here means there is no
        #       available leases, and is intentional. Do not initialize to 0.
        last_lease_refresh_v4: dict[int, int] = {}
        last_lease_refresh_v6: dict[int, int] = {}

        # Initialize so even subnets without leases return _some_ data
        for subnet_id in subnet_ids:
            subnet_lease_counts[subnet_id] = 0

        # Add data for subnet counts
        for lease in v4_leases+v6_leases:
            if not lease.subnet_id:
                continue
            subnet_lease_counts[lease.subnet_id] += 1

        # Add data for last lease refresh (subnet "staleness")
        for lease in v4_leases:
            if not lease.subnet_id or not lease.cltt:
                continue
            last_lease_refresh_v4[lease.subnet_id] = max(
                lease.cltt,
                last_lease_refresh_v4[lease.subnet_id] or 0
            )
        for lease in v6_leases:
            if not lease.subnet_id or not lease.cltt:
                continue
            last_lease_refresh_v6[lease.subnet_id] = max(
                lease.cltt,
                last_lease_refresh_v6[lease.subnet_id] or 0
            )

        # Return object should match format expected by frontend:
        # {
        #   time: collection timestamp (int)
        #   dhcp4: object, key=[subnet_id (int)], value=last dhcp refresh timestamp (int)
        #   dhcp6: object, key=[subnet_id (int)], value=last dhcp refresh timestamp (int)
        #   networks: {
        #     [subnet_id (int)]: {
        #       clients: leases per subnet (int)
        #     }
        #   }
        # }
        return {
            "time": now,
            "dhcpv4": last_lease_refresh_v4,
            "dhcpv6": last_lease_refresh_v4,
            "networks": subnet_lease_counts
        }

dhcp = KeaDHCPServer()
