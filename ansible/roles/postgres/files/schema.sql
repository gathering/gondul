--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.11
-- Dumped by pg_dump version 9.6.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: comment_state; Type: TYPE; Schema: public; Owner: nms
--

CREATE TYPE public.comment_state AS ENUM (
    'active',
    'inactive',
    'persist',
    'delete'
);


ALTER TYPE public.comment_state OWNER TO nms;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: config; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.config (
    id integer NOT NULL,
    publicvhost character varying,
    shortname character varying,
    data jsonb
);


ALTER TABLE public.config OWNER TO nms;

--
-- Name: config_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.config_id_seq OWNER TO nms;

--
-- Name: config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE public.config_id_seq OWNED BY public.config.id;


--
-- Name: dhcp; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.dhcp (
    network integer,
    "time" timestamp with time zone,
    mac macaddr,
    ip inet,
    dhcp_server integer
);


ALTER TABLE public.dhcp OWNER TO nms;

--
-- Name: linknet_ping; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.linknet_ping (
    linknet integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency1_ms double precision,
    latency2_ms double precision
);


ALTER TABLE public.linknet_ping OWNER TO nms;

--
-- Name: linknets; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.linknets (
    linknet integer NOT NULL,
    switch1 integer NOT NULL,
    addr1 inet,
    switch2 integer NOT NULL,
    addr2 inet,
    port1 character varying(10),
    port2 character varying(10)
);


ALTER TABLE public.linknets OWNER TO nms;

--
-- Name: linknets_linknet_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.linknets_linknet_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.linknets_linknet_seq OWNER TO nms;

--
-- Name: linknets_linknet_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE public.linknets_linknet_seq OWNED BY public.linknets.linknet;


--
-- Name: metrics; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.metrics (
    "time" timestamp with time zone DEFAULT now(),
    src text,
    metadata jsonb,
    data jsonb
);


ALTER TABLE public.metrics OWNER TO nms;

--
-- Name: networks; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.networks (
    name character varying NOT NULL,
    subnet4 cidr,
    subnet6 cidr,
    gw4 inet,
    gw6 inet,
    vlan integer,
    tags jsonb DEFAULT '[]'::jsonb,
    network integer NOT NULL,
    router integer
);


ALTER TABLE public.networks OWNER TO nms;

--
-- Name: networks_network_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.networks_network_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.networks_network_seq OWNER TO nms;

--
-- Name: networks_networks_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.networks_networks_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.networks_networks_seq OWNER TO nms;

--
-- Name: networks_networks_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE public.networks_networks_seq OWNED BY public.networks.network;


--
-- Name: oplog; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.oplog (
    id integer NOT NULL,
    "time" timestamp with time zone DEFAULT now(),
    systems character varying,
    username character varying,
    log text
);


ALTER TABLE public.oplog OWNER TO nms;

--
-- Name: oplog_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.oplog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.oplog_id_seq OWNER TO nms;

--
-- Name: oplog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE public.oplog_id_seq OWNED BY public.oplog.id;


--
-- Name: ping; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.ping (
    switch integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms double precision
);


ALTER TABLE public.ping OWNER TO nms;

--
-- Name: ping_secondary_ip; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.ping_secondary_ip (
    switch integer NOT NULL,
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    latency_ms double precision
);


ALTER TABLE public.ping_secondary_ip OWNER TO nms;

--
-- Name: seen_mac; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.seen_mac (
    mac macaddr NOT NULL,
    address inet NOT NULL,
    seen timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seen_mac OWNER TO nms;

--
-- Name: snmp; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.snmp (
    "time" timestamp with time zone DEFAULT now() NOT NULL,
    switch integer NOT NULL,
    data jsonb,
    id integer NOT NULL
);


ALTER TABLE public.snmp OWNER TO nms;

--
-- Name: snmp_id_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.snmp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.snmp_id_seq OWNER TO nms;

--
-- Name: snmp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nms
--

ALTER SEQUENCE public.snmp_id_seq OWNED BY public.snmp.id;


--
-- Name: switches; Type: TABLE; Schema: public; Owner: nms
--

CREATE TABLE public.switches (
    switch integer DEFAULT nextval(('"switches_switch_seq"'::text)::regclass) NOT NULL,
    mgmt_v4_addr inet,
    sysname character varying NOT NULL,
    last_updated timestamp with time zone,
    locked boolean DEFAULT false NOT NULL,
    poll_frequency interval DEFAULT '00:01:00'::interval NOT NULL,
    community character varying DEFAULT 'IskremTilMiddag'::character varying NOT NULL,
    mgmt_v6_addr inet,
    placement box,
    distro_name character varying,
    distro_phy_port character varying(100),
    tags jsonb DEFAULT '[]'::jsonb,
    deleted boolean DEFAULT false,
    mgmt_vlan character varying,
    traffic_vlan character varying
);


ALTER TABLE public.switches OWNER TO nms;

--
-- Name: switches_switch_seq; Type: SEQUENCE; Schema: public; Owner: nms
--

CREATE SEQUENCE public.switches_switch_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.switches_switch_seq OWNER TO nms;

--
-- Name: config id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.config ALTER COLUMN id SET DEFAULT nextval('public.config_id_seq'::regclass);


--
-- Name: linknets linknet; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.linknets ALTER COLUMN linknet SET DEFAULT nextval('public.linknets_linknet_seq'::regclass);


--
-- Name: networks network; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.networks ALTER COLUMN network SET DEFAULT nextval('public.networks_networks_seq'::regclass);


--
-- Name: oplog id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.oplog ALTER COLUMN id SET DEFAULT nextval('public.oplog_id_seq'::regclass);


--
-- Name: snmp id; Type: DEFAULT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.snmp ALTER COLUMN id SET DEFAULT nextval('public.snmp_id_seq'::regclass);


--
-- Name: seen_mac seen_mac_pkey; Type: CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.seen_mac
    ADD CONSTRAINT seen_mac_pkey PRIMARY KEY (mac, address, seen);


--
-- Name: switches switches_pkey; Type: CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.switches
    ADD CONSTRAINT switches_pkey PRIMARY KEY (switch);


--
-- Name: switches switches_sysname_key; Type: CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.switches
    ADD CONSTRAINT switches_sysname_key UNIQUE (sysname);


--
-- Name: switches switches_sysname_key1; Type: CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.switches
    ADD CONSTRAINT switches_sysname_key1 UNIQUE (sysname);


--
-- Name: dhcp_ip; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX dhcp_ip ON public.dhcp USING btree (ip);


--
-- Name: dhcp_mac; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX dhcp_mac ON public.dhcp USING btree (mac);


--
-- Name: dhcp_network; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX dhcp_network ON public.dhcp USING btree (network);


--
-- Name: dhcp_time; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX dhcp_time ON public.dhcp USING btree ("time");


--
-- Name: metric_data; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX metric_data ON public.metrics USING gin (data);


--
-- Name: ping_brin_time; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX ping_brin_time ON public.ping USING brin ("time");


--
-- Name: ping_index; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX ping_index ON public.ping USING btree ("time");


--
-- Name: ping_secondary_index; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX ping_secondary_index ON public.ping_secondary_ip USING btree ("time");


--
-- Name: ping_switch_time_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX ping_switch_time_btree ON public.ping USING btree (switch, "time");


--
-- Name: ping_switch_time_unique_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE UNIQUE INDEX ping_switch_time_unique_btree ON public.ping USING btree (switch, "time");


--
-- Name: seen_mac_addr_family; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX seen_mac_addr_family ON public.seen_mac USING btree (family(address));


--
-- Name: seen_mac_seen; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX seen_mac_seen ON public.seen_mac USING btree (seen);


--
-- Name: snmp_brin_switch_time; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_brin_switch_time ON public.snmp USING brin (switch, "time");


--
-- Name: snmp_id_desc_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_id_desc_btree ON public.snmp USING btree (id DESC);


--
-- Name: snmp_id_desc_switch_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_id_desc_switch_btree ON public.snmp USING btree (id DESC, switch);


--
-- Name: snmp_id_switch_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_id_switch_btree ON public.snmp USING btree (id, switch);


--
-- Name: snmp_switch_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_switch_btree ON public.snmp USING btree (switch);


--
-- Name: snmp_switch_id_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_switch_id_btree ON public.snmp USING btree (switch, id);


--
-- Name: snmp_switch_id_desc_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_switch_id_desc_btree ON public.snmp USING btree (switch, id DESC);


--
-- Name: snmp_switch_time_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_switch_time_btree ON public.snmp USING btree (switch, "time");


--
-- Name: snmp_time; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_time ON public.snmp USING btree ("time");


--
-- Name: snmp_time6; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_time6 ON public.snmp USING btree ("time" DESC, switch);


--
-- Name: snmp_time_brin; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX snmp_time_brin ON public.snmp USING brin ("time");


--
-- Name: snmp_unique_switch_time_btree; Type: INDEX; Schema: public; Owner: nms
--

CREATE UNIQUE INDEX snmp_unique_switch_time_btree ON public.snmp USING btree (switch, "time");


--
-- Name: switches_switch; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX switches_switch ON public.switches USING hash (switch);


--
-- Name: updated_index2; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX updated_index2 ON public.linknet_ping USING btree ("time");


--
-- Name: updated_index3; Type: INDEX; Schema: public; Owner: nms
--

CREATE INDEX updated_index3 ON public.ping_secondary_ip USING btree ("time");


--
-- Name: networks networks_router_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.networks
    ADD CONSTRAINT networks_router_fkey FOREIGN KEY (router) REFERENCES public.switches(switch);


--
-- Name: snmp snmp_switch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.snmp
    ADD CONSTRAINT snmp_switch_fkey FOREIGN KEY (switch) REFERENCES public.switches(switch);


--
-- Name: ping switchname; Type: FK CONSTRAINT; Schema: public; Owner: nms
--

ALTER TABLE ONLY public.ping
    ADD CONSTRAINT switchname FOREIGN KEY (switch) REFERENCES public.switches(switch);


--
-- Name: SEQUENCE snmp_id_seq; Type: ACL; Schema: public; Owner: nms
--

GRANT ALL ON SEQUENCE public.snmp_id_seq TO postgres;


--
-- PostgreSQL database dump complete
--

