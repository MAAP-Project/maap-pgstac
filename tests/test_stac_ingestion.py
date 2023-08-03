import pytest
import pystac
from pystac import STACValidationError

# Test validating the collection
def test_validate_collection(test_collection):
    try:
        pystac.validation.validate_dict(test_collection)
    except STACValidationError as e:
        pytest.fail(f"Validation failed for test_collection {e}")


# Test validating the item
def test_validate_item(test_item):
    try:
        pystac.validation.validate_dict(test_item)
    except STACValidationError as e:
        pytest.fail(f"Validation failed for test_item {e}")


# Test inserting collection
def test_insert_collection(
    stac_ingestion_instance, authentication_token, test_collection
):
    response = stac_ingestion_instance.insert_collection(
        authentication_token, test_collection
    )
    assert response.status_code in [200, 201], f"Failed to insert the test_collection {response.text}"


# Test inserting item
def test_insert_item(stac_ingestion_instance, authentication_token, test_item):
    response = stac_ingestion_instance.insert_item(authentication_token, test_item)
    assert response.status_code in [200, 201], f"Failed to insert the test_item {response.text}"


# Test querying collection and verifying inserted collection
def test_query_collection(stac_ingestion_instance, test_collection):
    response = stac_ingestion_instance.query_collection(test_collection["id"])
    assert response.status_code in [200, 201], f"Failed to query the test_collection {response.text}"


# Test querying items and verifying inserted items
def test_query_items(stac_ingestion_instance, test_collection, test_item):
    response = stac_ingestion_instance.query_items(test_collection["id"])
    assert response.status_code in [200, 201], f"Failed to query the items {response.text}"
    item = response.json()["features"][0]
    print(item)
    assert any(
        item["id"] == test_item["id"]
    ), f"Inserted item - {test_item} \n not found in the queried items {items}"


# Run the tests
if __name__ == "__main__":
    pytest.main()
