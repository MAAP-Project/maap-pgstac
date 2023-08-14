import pytest
import pystac
from pystac import STACValidationError
import time

# Test validating the collection
def test_validate_collection(test_collection):
    pystac.validation.validate_dict(test_collection)
    

# Test validating the item
def test_validate_item(test_item):
    pystac.validation.validate_dict(test_item)


# Test inserting collection
def test_insert_collection(
    stac_ingestion_instance, authentication_token, test_collection
):
    response = stac_ingestion_instance.insert_collection(
        authentication_token, test_collection
    )
    assert response.status_code in [200, 201], f"Failed to insert the test_collection :\n{response.text}"
    # Wait for the collection to be inserted
    time.sleep(10)

# Test inserting item
def test_insert_item(stac_ingestion_instance, authentication_token, test_item):
    response = stac_ingestion_instance.insert_item(authentication_token, test_item)
    assert response.status_code in [200, 201], f"Failed to insert the test_item :\n{response.text}"
    # Wait for the item to be inserted
    time.sleep(10)


# Test querying collection and verifying inserted collection
def test_query_collection(stac_ingestion_instance, test_collection):
    response = stac_ingestion_instance.query_collection(test_collection["id"])
    assert response.status_code in [200, 201], f"Failed to query the test_collection :\n{response.text}"


# Test querying items and verifying inserted items
def test_query_items(stac_ingestion_instance, test_collection, test_item):
    response = stac_ingestion_instance.query_items(test_collection["id"])
    assert response.status_code in [200, 201], f"Failed to query the items :\n{response.text}"
    item = response.json()["features"][0]
    assert item["id"] == test_item["id"], f"Inserted item - {test_item} \n not found in the queried items {item}"


# Test querying collection and verifying inserted collection
def test_delete_collection(
    stac_ingestion_instance, authentication_token, test_collection
):
    response = stac_ingestion_instance.delete_collection(authentication_token, test_collection["id"])
    assert response.status_code in [200, 201], f"Failed to delete the test_collection :\n{response.text}"

# Run the tests
if __name__ == "__main__":
    pytest.main()
