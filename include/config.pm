#! /usr/bin/perl
use strict;
use warnings;
package nms::config;

# DB
our $db_name = "nms";
our $db_host = "localhost";
our $db_username = "nms";
our $db_password = "risbrod";
our $graphite_host = "graphite";
our $graphite_port = "2003";

# Influx
our $influx_host = "http://localhost:8086";
our $influx_username = "gondulWrite";
our $influx_password = "pasr";
our $influx_database = "gondul";

# Max SNMP polls to fire off at the same time.
our $snmp_max = 20;

# What SNMP objects to fetch.
our @snmp_objects = [
	['ifIndex'],
	['sysName'],
	['sysDescr'],
	['ifHighSpeed'],
	['ifType'],
	['ifName'],
	['ifDescr'],
	['ifAlias'],
	['ifOperStatus'],
	['ifAdminStatus'],
	['ifLastChange'],
	['ifPhysAddress'],
	['ifHCInOctets'],
	['ifHCOutOctets'],
	['ifInDiscards'],
	['ifOutDiscards'],
	['ifInErrors'],
	['ifOutErrors'],
	['ifInUnknownProtos'],
	['ifOutQLen'],
	['sysUpTime'],
	['ciscoEnvMonTemperatureStatusValue'],
	['ipIfStatsHCInOctets'],
	['ipIfStatsHCOutOctets'],
	['ipIfStatsIPVersion'],
	['entPhysicalSerialNum'],
	['entPhysicalName'],
	['entPhysicalHardwareRev'],
	['entPhysicalFirmwareRev'],
	['entPhysicalSoftwareRev'],
	['entPhysicalDescr'],
	['jnxOperatingTemp'],
	['jnxOperatingCPU'],
	['jnxOperatingDescr'],
	['jnxBoxSerialNo'],
	['jnxVirtualChassisFpcId'],
	['jnxVirtualChassisPortName'],
	['jnxVirtualChassisPortAdminStatus'],
	['jnxVirtualChassisPortOperStatus'],
	['jnxVirtualChassisPortInPkts'],
	['jnxVirtualChassisPortOutPkts'],
	['jnxVirtualChassisPortInOctets'],
	['jnxVirtualChassisPortOutOctets'],
	['jnxVirtualChassisPortInMcasts'],
	['jnxVirtualChassisPortOutMcasts'],
	['jnxVirtualChassisPortInPkts1secRate'],
	['jnxVirtualChassisPortOutPkts1secRate'],
	['jnxVirtualChassisPortInOctets1secRate'],
	['jnxVirtualChassisPortOutOctets1secRate'],
	['jnxVirtualChassisPortCarrierTrans'],
	['jnxVirtualChassisPortInCRCAlignErrors'],
	['jnxVirtualChassisPortUndersizePkts'],
	['jnxVirtualChassisPortCollisions'],
	['jnxVirtualChassisMemberFabricMode'],
	['jnxVirtualChassisMemberLocation'],
	['jnxVirtualChassisMemberMixedMode'],
	['jnxVirtualChassisMemberModel'],
	['jnxVirtualChassisMemberPriority'],
	['jnxVirtualChassisMemberRole'],
	['jnxVirtualChassisMemberSerialnumber'],
	['jnxVirtualChassisMemberSWVersion'],
	['jnxVirtualChassisMemberUptime'],
	['jnxDomCurrentRxLaserPower'],
	['jnxDomCurrentTxLaserOutputPower'],
	['jnxPMCurRxInputPower'],
	['jnxPMCurTxOutputPower']

];

BEGIN {
	eval {
		require "/opt/gondul/include/config.local.pm";
	};
}
1;
