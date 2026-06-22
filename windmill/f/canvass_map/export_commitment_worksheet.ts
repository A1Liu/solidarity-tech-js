import * as wmill from 'windmill-client'

type Postgresql = {
  host: string
  port: number
  user: string
  dbname: string
  region: string
  sslmode: string
  password: string
  use_iam_auth: boolean
  root_certificate_pem: string
}

type GcpServiceAccount = {
  type: string
  auth_uri: string
  client_id: string
  token_uri: string
  project_id: string
  private_key: string
  client_email: string
  private_key_id: string
  client_x509_cert_url: string
  auth_provider_x509_cert_url: string
}

export async function main(destinationSheet: string) {
  const db: Postgresql = await wmill.getResource('f/canvass_map/database')
  const gcs: GcpServiceAccount = await wmill.getResource(
    'f/tnt_core/drive_service_account',
  )

  console.log(db, gcs, destinationSheet)
  // TODO - implement script
  return 5
}
