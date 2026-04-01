import logging
import time

from pyisckea import Kea
from pyisckea.models.dhcp4.lease import Lease4
from pyisckea.models.dhcp6.lease import Lease6
from validators import url

from app.core.config import settings

URIS = {
    "v4": settings.KEA_DHCP4_API_URI if settings.KEA_DHCP4_API_URI else "",
    "v6": settings.KEA_DHCP6_API_URI if settings.KEA_DHCP6_API_URI else ""
}

vlan_id = int
subnet_id = int

class DHCPSubnetDetails():
    clients: int
    """Leases"""

    def __init__(self, clients: int = 0) -> None:
        self.clients = clients


class DHCPSummaryResponse():
    # Weird field namings and format is because this is what is expected by gondul
    dhcp: dict[int, int]
    """Has two keys `4` and `6`, each having the amount of unique IP leases for the respective IP version"""

    def __init__(self, dhcp: dict[int, int] = {}) -> None:
        self.dhcp = dhcp


class DHCPDetailsResponse():
    # Weird field namings and format is because this is what is expected by gondul
    time: int = round(time.time())
    """data collection unix timestamp"""

    dhcp4: dict[vlan_id, int] = {}
    """key=[vlan_id], value=last dhcp refresh unix timestamp"""
    dhcp6: dict[vlan_id, int] = {}
    """key=[vlan_id], value=last dhcp refresh unix timestamp"""

    networks: dict[int, DHCPSubnetDetails] = {}
    """key=[vlan_id], value={ clients: leases per VLAN }"""


class DummyDHCPServer():
    def get_summary(self) -> DHCPSummaryResponse:
        return DHCPSummaryResponse({})

    def get_details(self) -> DHCPDetailsResponse:
        response = DHCPDetailsResponse()
        return response


class KeaDHCPServer():
    _v4_client: Kea
    _v6_client: Kea
    _logger = logging.getLogger(__name__)

    def __init__(self) -> None:
        self._v4_client = Kea(URIS["v4"])
        self._v6_client = Kea(URIS["v6"])

    def _get_v4_leases(self) -> list[Lease4]:
        leases = self._v4_client.dhcp4.lease4_get_all()
        self._logger.debug(leases)
        return leases

    def _get_v6_leases(self) -> list[Lease6]:
        leases = self._v6_client.dhcp6.lease6_get_all()
        self._logger.debug(leases)
        return leases

    def _get_subnet_vlan_mappings(self) -> dict[subnet_id, vlan_id]:
        """
        Returns mappings from Netbox ID (used for subnets in and returned by Kea)
        to VLAN ID (expected by gondul).

        Key: Netbox (Subnet) ID; Value: VLAN ID
        """
        subnets_v4_v6 = [
            # Separate lists here because they require separate clients to fetch data (annoyingly)
            [self._v4_client.dhcp4.subnet4_list(), self._v4_client.dhcp4.subnet4_get],
            [self._v6_client.dhcp6.subnet6_list(), self._v6_client.dhcp6.subnet6_get]
        ]

        subnet_vlan_mapping: dict[subnet_id, vlan_id] = {}
        for [subnets, get_subnet_details] in subnets_v4_v6:
            for subnet in subnets:
                if not subnet.id:
                    continue
                subnet_details = get_subnet_details(subnet.id)

                if not subnet_details.user_context or (
                    "vlan-id" not in subnet_details.user_context
                    and "vlan_id" not in subnet_details.user_context
                ):
                    continue

                subnet_vlan_mapping[subnet.id] = subnet_details.user_context["vlan-id"] or subnet_details.user_context["vlan_id"]

        return subnet_vlan_mapping

    def get_summary(self) -> DHCPSummaryResponse:
        # In frontend: Saves to nmsdata.dhcpsummary, see nms-dhcp.js
        v4 = self._get_v4_leases()
        v6 = self._get_v6_leases()

        unique_v4 = len(set([lease.ip_address for lease in v4]))
        unique_v6 = len(set([lease.ip_address for lease in v6]))

        return DHCPSummaryResponse({4: unique_v4, 6: unique_v6})

    def get_details(self) -> DHCPDetailsResponse:
        # In frontend: Saves to nmsdata.dhcp, see nms-map-handlers.js, function dhcpUpdater and dhcpInfo
        v4_leases = [lease for lease in self._get_v4_leases() if lease.subnet_id]
        v6_leases = [lease for lease in self._get_v6_leases() if lease.subnet_id]

        subnet_vlan_mappings = self._get_subnet_vlan_mappings()

        # Key: VLAN ID (NOT subnet ID from Kea, as this is the Netbox object ID)
        # Value: Object containing the amount of leases belonging to that vlan
        vlan_lease_counts: dict[int, DHCPSubnetDetails] = {}

        # Key: VLAN ID (NOT subnet ID from Kea, as this is the Netbox object ID)
        # Value: Unix timestamp to the last time this was updated
        # Note: A VLAN not being defined as a key in here means there is no
        #       available leases, and there is no timestamp for the last refresh available.
        #       Do NOT initialize all VLANs to 0.
        last_lease_refresh_v4: dict[int, int] = {}
        last_lease_refresh_v6: dict[int, int] = {}

        # Initialize VLAN lease counts so all VLANs return _some_ data
        for _index, (_netbox_id, vlan_id) in enumerate(subnet_vlan_mappings.items()):
            vlan_lease_counts[vlan_id] = DHCPSubnetDetails(0)

        for lease in v4_leases+v6_leases:
            if lease.subnet_id not in subnet_vlan_mappings:
                continue
            vlan_id = subnet_vlan_mappings[lease.subnet_id]
            vlan_lease_counts[vlan_id].clients += 1

        _temp = [
            [v4_leases, last_lease_refresh_v4],
            [v6_leases, last_lease_refresh_v6],
        ]

        # Add timestamps for last DHCP lease refresh ("staleness")
        for [leases, last_refreshed] in _temp:
            for lease in leases:
                if (not lease.cltt or lease.subnet_id not in subnet_vlan_mappings):
                    continue

                vlan_id = subnet_vlan_mappings[lease.subnet_id]

                if vlan_id in last_refreshed:
                    last_refreshed[vlan_id] = max(lease.cltt, last_refreshed[vlan_id])
                else:
                    last_refreshed[vlan_id] = max(lease.cltt, 0)

        response = DHCPDetailsResponse()
        response.dhcp4 = last_lease_refresh_v4
        response.dhcp6 = last_lease_refresh_v6
        response.networks = vlan_lease_counts

        return response


dhcp: DummyDHCPServer | KeaDHCPServer
if not url(URIS["v4"]) or not url(URIS["v6"]):
    dhcp = DummyDHCPServer()
else:
    dhcp = KeaDHCPServer()
