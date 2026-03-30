import logging
import time

from pyisckea import Kea
from validators import url

from app.core.config import settings

URIS = {
    "v4": settings.KEA_DHCP4_API_URI if settings.KEA_DHCP4_API_URI else "",
    "v6": settings.KEA_DHCP6_API_URI if settings.KEA_DHCP6_API_URI else ""
}


class DHCPSubnetDetails():
    clients: int
    """Leases"""

    def __init__(self, clients: int) -> None:
        self.clients = clients

# Weird field namings and format is because this is what is expected by gondul


class DHCPSummaryResponse():
    dhcp: dict[int, int]
    """Has two keys `4` and `6`, each having the amount of unique IP leases for the respective IP version"""

    def __init__(self, dhcp: dict[int, int]) -> None:
        self.dhcp = dhcp

# Weird field namings and format is because this is what is expected by gondul


class DHCPDetailsResponse():
    time: int
    """data collection unix timestamp"""

    dhcpv4: dict[int, int]
    """key=[subnet_id], value=last dhcp refresh unix timestamp"""
    dhcpv6: dict[int, int]
    """key=[subnet_id], value=last dhcp refresh unix timestamp"""

    networks: dict[int, DHCPSubnetDetails]
    """key=[subnet_id], value={ clients: leases per subnet }"""


class DummyDHCPServer():
    def get_summary(self):
        return {"dhcp": {}}

    def get_details(self):
        return {}


class KeaDHCPServer():
    _v4_client: Kea
    _v6_client: Kea
    _logger = logging.getLogger(__name__)

    def __init__(self) -> None:
        self._v4_client = Kea(URIS["v4"])
        self._v6_client = Kea(URIS["v6"])

    def _get_v4_leases(self):
        leases = self._v4_client.dhcp4.lease4_get_all()
        self._logger.debug(leases)
        return leases

    def _get_v6_leases(self):
        leases = self._v6_client.dhcp6.lease6_get_all()
        self._logger.debug(leases)
        return leases

    def _get_subnet_ids(self):
        """
        Returns subnet IDs for both IPv4 and IPv6 subnets
        """
        v4 = self._v4_client.dhcp4.subnet4_list()
        v6 = self._v6_client.dhcp6.subnet6_list()
        return [net.id for net in v4+v6 if net.id]

    def get_summary(self):
        # In frontend: Saves to nmsdata.dhcpsummary, see nms-dhcp.js
        v4 = self._get_v4_leases()
        v6 = self._get_v6_leases()

        unique_v4 = len(set([lease.ip_address for lease in v4]))
        unique_v6 = len(set([lease.ip_address for lease in v6]))

        return DHCPSummaryResponse({4: unique_v4, 6: unique_v6})

    def get_details(self) -> DHCPDetailsResponse:
        # In frontend: Saves to nmsdata.dhcp, see nms-map-handlers.js, function dhcpUpdater and dhcpInfo
        v4_leases = [lease for lease in self._get_v4_leases()
                     if lease.subnet_id]
        v6_leases = [lease for lease in self._get_v6_leases()
                     if lease.subnet_id]
        subnet_ids = self._get_subnet_ids()

        # When this data collection has occurred
        now: int = round(time.time())

        # Key: Subnet ID as defined by Kea
        # Value: Amount of leases belonging to that subnet
        subnet_lease_counts: dict[int, DHCPSubnetDetails] = {}

        # Key: Subnet ID as defined by Kea
        # Value: Unix timestamp to the last time this was updated
        # Note: A subnet not being defined as a key in here means there is no
        #       available leases, and is intentional. Do not initialize to 0.
        last_lease_refresh_v4: dict[int, int] = {}
        last_lease_refresh_v6: dict[int, int] = {}

        # Initialize so even subnets without leases return _some_ data
        for subnet_id in subnet_ids:
            subnet_lease_counts[subnet_id] = DHCPSubnetDetails(0)

        # Add data for subnet counts
        for lease in v4_leases+v6_leases:
            if not lease.subnet_id:
                continue
            subnet_lease_counts[lease.subnet_id].clients += 1

        # Add data for last lease refresh (subnet "staleness")
        for lease in v4_leases:
            if not lease.subnet_id or not lease.cltt:
                continue
            if lease.subnet_id in last_lease_refresh_v4:
                last_lease_refresh_v4[lease.subnet_id] = max(
                    lease.cltt,
                    last_lease_refresh_v4[lease.subnet_id]
                )
            else:
                last_lease_refresh_v4[lease.subnet_id] = max(lease.cltt, 0)

        for lease in v6_leases:
            if not lease.subnet_id or not lease.cltt:
                continue

            if lease.subnet_id in last_lease_refresh_v6:
                last_lease_refresh_v6[lease.subnet_id] = max(
                    lease.cltt,
                    last_lease_refresh_v6[lease.subnet_id]
                )
            else:
                last_lease_refresh_v6[lease.subnet_id] = max(lease.cltt, 0)

        response = DHCPDetailsResponse()
        response.time = now
        response.dhcpv4 = last_lease_refresh_v4
        response.dhcpv6 = last_lease_refresh_v6
        response.networks = subnet_lease_counts

        return response


dhcp: DummyDHCPServer | KeaDHCPServer
if not url(URIS["v4"]) or not url(URIS["v6"]):
    dhcp = DummyDHCPServer()
else:
    dhcp = KeaDHCPServer()
