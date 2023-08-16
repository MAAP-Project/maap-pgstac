import requests
import boto3
import json


client = boto3.client("secretsmanager", region_name="us-west-2")
secret_id = ""
res_secret = client.get_secret_value(SecretId=secret_id)
secret = json.loads(res_secret["SecretString"])
print(secret)

client_secret = secret['client_secret']
cognito_domain = secret['cognito_domain']
scope = secret['scope']

res_token = requests.post(
    f"{cognito_domain}/oauth2/token",
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
    },
    auth=(client_id, client_secret),
    data={
        "grant_type": "client_credentials",
        # A space-separated list of scopes to request for the generated access token.
        "scope": scope,
    },
)

TOKEN = res_token.json()["access_token"]

INGESTOR_API = ''

session = requests.Session()

session.request(method='DELETE',
                url=f'{INGESTOR_API}/collections/test_collection1',
                headers={'Authorization': f'bearer {TOKEN}'})
