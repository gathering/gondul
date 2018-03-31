--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

--
-- Name: comment_state; Type: TYPE; Schema: public; Owner: nms
--

CREATE TYPE comment_state AS ENUM (
    'active',
    'inactive',
    'persist',
    'delete'
);


ALTER TYPE comment_state OWNER TO nms;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: config; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE config (
    id integer NOT NULL,
    publicvhost character varying,
    shortname character varying,
    data jsonb
);


ALTER TABLE config OWNER TO nms;

--
-- Name: config_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE config_id_seq OWNER TO nms;

--
-- Name: config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE config_id_seq OWNED BY config.id;


--
-- Name: dhcp; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE dhcp (
    switch integer,
    "time" timestamp with time zone,
    mac macaddr,
    ip inet,
    dhcp_server integer
);


ALTER TABLE dhcp OWNER TO nms;

--
-- Name: linknet_ping; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE linknet_ping (
    linknet integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency1_ms double precision,
    latency2_ms double precision
);


ALTER TABLE linknet_ping OWNER TO nms;

--
-- Name: linknets; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE linknets (
    linknet integer NOT NULL,
    switch1 integer NOT NULL,
    addr1 inet,
    switch2 integer NOT NULL,
    addr2 inet,
    port1 character varying(10),
    port2 character varying(10)
);


ALTER TABLE linknets OWNER TO nms;

--
-- Name: linknets_linknet_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE linknets_linknet_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE linknets_linknet_seq OWNER TO nms;

--
-- Name: linknets_linknet_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE linknets_linknet_seq OWNED BY linknets.linknet;


--
-- Name: oplog; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE oplog (
    id integer NOT NULL,
    "time" timestamp with time zone DEFAULT now(),
    systems character varying,
    username character varying,
    log text
);


ALTER TABLE oplog OWNER TO nms;

--
-- Name: oplog_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE oplog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE oplog_id_seq OWNER TO nms;

--
-- Name: oplog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE oplog_id_seq OWNED BY oplog.id;


--
-- Name: ping; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE ping (
    switch integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms double precision
);


ALTER TABLE ping OWNER TO nms;

--
-- Name: ping_secondary_ip; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE ping_secondary_ip (
    switch integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms double precision
);


ALTER TABLE ping_secondary_ip OWNER TO nms;

--
-- Name: seen_mac; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE seen_mac (
    mac macaddr NOT NULL,
    address inet NOT NULL,
    seen timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE seen_mac OWNER TO nms;

--
-- Name: snmp; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE snmp (
    "time" timestamp without time zone DEFAULT now() NOT NULL,
    switch integer NOT NULL,
    data jsonb,
    id integer NOT NULL
);


ALTER TABLE snmp OWNER TO nms;

--
-- Name: snmp_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE snmp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE snmp_id_seq OWNER TO nms;

--
-- Name: snmp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE snmp_id_seq OWNED BY snmp.id;


--
-- Name: switches; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE switches (
    switch integer DEFAULT nextval(('"switches_switch_seq"'::text)::regclass) NOT NULL,
    mgmt_v4_addr inet,
    mgmt_v6_addr inet,
    mgmt_vlan character varying,
    sysname character varying NOT NULL,
    last_updated timestamp with time zone,
    locked boolean DEFAULT false NOT NULL,
    poll_frequency interval DEFAULT '00:01:00'::interval NOT NULL,
    community character varying DEFAULT 'FullPuppTilNMS'::character varying NOT NULL,
    placement box,
    distro_name character varying,
    distro_phy_port character varying(100),
    traffic_vlan character varying,
    tags jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE switches OWNER TO nms;

--
-- Name: switches_switch_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE switches_switch_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE switches_switch_seq OWNER TO nms;

--
-- Name: networks; Type: TABLE; Schema: public; Owner: nms; Tablespace:
--

CREATE TABLE networks (
    network integer DEFAULT nextval(('"networks_network_seq"'::text)::regclass) NOT NULL,
    name character varying NOT NULL,
    last_updated timestamp with time zone,
    placement box,
    subnet4 cidr,
    subnet6 cidr,
    gw4 inet,
    gw6 inet,
    routing_point character varying,
    vlan integer,
    tags jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE networks OWNER TO nms;

CREATE SEQUENCE networks_network_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE networks_network_seq OWNER TO nms;

--
-- Name: id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY config ALTER COLUMN id SET DEFAULT nextval('config_id_seq'::regclass);


--
-- Name: linknet; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY linknets ALTER COLUMN linknet SET DEFAULT nextval('linknets_linknet_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY oplog ALTER COLUMN id SET DEFAULT nextval('oplog_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY snmp ALTER COLUMN id SET DEFAULT nextval('snmp_id_seq'::regclass);


--
-- Name: seen_mac_pkey; Type: CONSTRAINT; Schema: public; Owner: nms; Tablespace:
--

ALTER TABLE ONLY seen_mac
    ADD CONSTRAINT seen_mac_pkey PRIMARY KEY (mac, address, seen);


--
-- Name: switches_pkey; Type: CONSTRAINT; Schema: public; Owner: nms; Tablespace:
--

ALTER TABLE ONLY switches
    ADD CONSTRAINT switches_pkey PRIMARY KEY (switch);


--
-- Name: switches_sysname_key; Type: CONSTRAINT; Schema: public; Owner: nms; Tablespace:
--

ALTER TABLE ONLY switches
    ADD CONSTRAINT switches_sysname_key UNIQUE (sysname);


--
-- Name: switches_sysname_key1; Type: CONSTRAINT; Schema: public; Owner: nms; Tablespace:
--

ALTER TABLE ONLY switches
    ADD CONSTRAINT switches_sysname_key1 UNIQUE (sysname);


--
-- Name: dhcp_ip; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX dhcp_ip ON dhcp USING btree (ip);


--
-- Name: dhcp_mac; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX dhcp_mac ON dhcp USING btree (mac);


--
-- Name: dhcp_switch; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX dhcp_switch ON dhcp USING btree (switch);


--
-- Name: dhcp_time; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX dhcp_time ON dhcp USING btree ("time");


--
-- Name: ping_index; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX ping_index ON ping USING btree ("time");


--
-- Name: ping_secondary_index; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX ping_secondary_index ON ping_secondary_ip USING btree ("time");


--
-- Name: seen_mac_addr_family; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX seen_mac_addr_family ON seen_mac USING btree (family(address));


--
-- Name: seen_mac_seen; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX seen_mac_seen ON seen_mac USING btree (seen);


--
-- Name: snmp_time; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX snmp_time ON snmp USING btree ("time");


--
-- Name: snmp_time15; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX snmp_time15 ON snmp USING btree (id, switch);


--
-- Name: snmp_time6; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX snmp_time6 ON snmp USING btree ("time" DESC, switch);


--
-- Name: switches_switch; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX switches_switch ON switches USING hash (switch);


--
-- Name: updated_index2; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX updated_index2 ON linknet_ping USING btree ("time");


--
-- Name: updated_index3; Type: INDEX; Schema: public; Owner: nms; Tablespace:
--

CREATE INDEX updated_index3 ON ping_secondary_ip USING btree ("time");


--
-- Name: dhcp_switch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY dhcp
    ADD CONSTRAINT dhcp_switch_fkey FOREIGN KEY (switch) REFERENCES switches(switch);


--
-- Name: snmp_switch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY snmp
    ADD CONSTRAINT snmp_switch_fkey FOREIGN KEY (switch) REFERENCES switches(switch);


--
-- Name: switchname; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY ping
    ADD CONSTRAINT switchname FOREIGN KEY (switch) REFERENCES switches(switch);


--
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- Name: config; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE config FROM PUBLIC;
REVOKE ALL ON TABLE config FROM nms;
GRANT ALL ON TABLE config TO nms;


--
-- Name: dhcp; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE dhcp FROM PUBLIC;
REVOKE ALL ON TABLE dhcp FROM nms;
GRANT ALL ON TABLE dhcp TO nms;


--
-- Name: linknet_ping; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE linknet_ping FROM PUBLIC;
REVOKE ALL ON TABLE linknet_ping FROM nms;
GRANT ALL ON TABLE linknet_ping TO nms;


--
-- Name: linknets; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE linknets FROM PUBLIC;
REVOKE ALL ON TABLE linknets FROM nms;
GRANT ALL ON TABLE linknets TO nms;


--
-- Name: ping; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE ping FROM PUBLIC;
REVOKE ALL ON TABLE ping FROM nms;
GRANT ALL ON TABLE ping TO nms;


--
-- Name: ping_secondary_ip; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE ping_secondary_ip FROM PUBLIC;
REVOKE ALL ON TABLE ping_secondary_ip FROM nms;
GRANT ALL ON TABLE ping_secondary_ip TO nms;


--
-- Name: seen_mac; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE seen_mac FROM PUBLIC;
REVOKE ALL ON TABLE seen_mac FROM nms;
GRANT ALL ON TABLE seen_mac TO nms;


--
-- Name: snmp; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE snmp FROM PUBLIC;
REVOKE ALL ON TABLE snmp FROM nms;
GRANT ALL ON TABLE snmp TO nms;
GRANT ALL ON TABLE snmp TO postgres;


--
-- Name: snmp_id_seq; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON SEQUENCE snmp_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE snmp_id_seq FROM nms;
GRANT ALL ON SEQUENCE snmp_id_seq TO nms;
GRANT ALL ON SEQUENCE snmp_id_seq TO postgres;


--
-- Name: switches; Type: ACL; Schema: public; Owner: nms
--

REVOKE ALL ON TABLE switches FROM PUBLIC;
REVOKE ALL ON TABLE switches FROM nms;
GRANT ALL ON TABLE switches TO nms;


--
-- PostgreSQL database dump complete
