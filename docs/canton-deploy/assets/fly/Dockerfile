# Canton 3.4 OSS single-process node (sequencer + mediator + participant +
# built-in HTTP JSON Ledger API on :7575). Uses the open-source tarball so
# `-c canton.conf --bootstrap bootstrap.canton` are honored — the
# canton-participant base image ignores custom configs.
FROM eclipse-temurin:17-jre-jammy

ARG CANTON_VERSION=3.4.8
ENV CANTON_HOME=/opt/canton

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p "${CANTON_HOME}" /canton/config /canton/data /opt/dars \
 && curl -fsSL -o /tmp/canton.tgz \
      "https://github.com/digital-asset/canton/releases/download/v${CANTON_VERSION}/canton-open-source-${CANTON_VERSION}.tar.gz" \
 && tar -xzf /tmp/canton.tgz -C "${CANTON_HOME}" --strip-components=1 \
 && rm /tmp/canton.tgz

COPY canton.conf      /canton/config/canton.conf
COPY bootstrap.canton /canton/config/bootstrap.canton
COPY jwt-public.crt   /canton/config/jwt-public.crt
COPY dars/            /opt/dars/

EXPOSE 7575 5011 5012

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/opt/canton/bin/canton", "daemon", \
     "-c", "/canton/config/canton.conf", \
     "--bootstrap", "/canton/config/bootstrap.canton"]
