from pyisckea import Kea

from app.core.config import settings

URIS = {
    "v4": settings.KEA_DHCP4_URI if settings.KEA_DHCP4_URI else "",
    "v6": settings.KEA_DHCP6_URI if settings.KEA_DHCP6_URI else ""
}


class KeaDHCPServer():
    _v4_client = Kea(URIS["v4"])
    _v6_client = Kea(URIS["v6"])

    def getv4leases(self):
        return self._v4_client.dhcp4.lease4_get_all()

    def getv6leases(self):
        return self._v6_client.dhcp6.lease6_get_all()

    def get_summary(self):
        v4 = self.getv4leases()
        v6 = self.getv6leases()

        unique_v4 = len(set([lease.ip_address for lease in v4]))
        unique_v6 = len(set([lease.ip_address for lease in v6]))

        # Weird format because this is what is expected by existing gui
        return {"dhcp": {4: unique_v4, 6: unique_v6} }

    def get_details(self):
        # {
        #   time: collection timestamp?
        #   dhcp4: number of ipv4 ips on a vlan?
        #   dhcp6: number of ipv6 ips on a vlan?
        # }
        pass

dhcp = KeaDHCPServer()
