# --- PROCESSING LOGS FROM LOAD_TESTS ---
TIMESTAMP=$1
FOLDER=$2
USER_COUNT=$3
USERNAME=$4

echo "-- Generate sum-up for load tests."

# --- create sum up file for gathering logs ---
sumupFile="$FOLDER/$TIMESTAMP/load-test-sumup.txt"
touch $sumupFile

# write users with failed tests
failedUsers=""
i=1
failedCounter=0
while [[ $i -le $USER_COUNT ]] 
do
  if [ -d $FOLDER/$TIMESTAMP/$USERNAME$i/report ]; then
    failedUsers="$failedUsers $USERNAME$i"
    failedCounter=$((failedCounter + 1))
  else
    if [[ $user_for_getting_test_names == "" ]]; then
      user_for_getting_test_names=$USERNAME$i
    fi
  fi
  i=$((i+1))
done

if [[ $failedUsers == "" ]]; then
  echo "Tests passed for all users, yay!"
  echo -e "Tests passed for all users, yay! \n" > $sumupFile
else
  echo "Test failed for $failedCounter/$USER_COUNT users: $failedUsers"
  echo -e "Test failed for $failedCounter/$USER_COUNT users: $failedUsers \n" >> $sumupFile
fi

if [[ $failedCounter -eq $USER_COUNT ]]; then
  echo "Tests failed for all users. Skipping generation logs."
  exit
fi

# change \r to \n in files
for file in $(find $FOLDER/$TIMESTAMP -name 'load-test-results.txt'); do
  sed -i 's/\r/\n/g' $file
done

if [ -z $user_for_getting_test_names ]; then
  echo "All users have failed test, not able to create final sum up."
  exit
fi

lineCounter=1
tests=$(wc -l < $FOLDER/$TIMESTAMP/$user_for_getting_test_names/load-test-folder/load-test-results.txt)

while [[ $lineCounter -le $tests ]]; do
  sum=0
  min=-1
  max=-1
  count=0
  sed "${lineCounter}q;d" $FOLDER/$TIMESTAMP/$user_for_getting_test_names/load-test-folder/load-test-results.txt | awk -F ':' '{print $1}' >> $sumupFile
  for file in $(find $FOLDER/$TIMESTAMP -name 'load-test-results.txt'); do
    actual=$(sed "${lineCounter}q;d" $file | awk -F ':' '{print $2}' | awk -F ' ' '{ print $1}')
    if [[ -z $actual ]]; then
      continue
    fi  
    sum=$(($sum + $actual))
    if [[ $min == -1 ]]; then
      min=$actual
    else
      if [[ $min -gt $actual ]]; then
        min=$actual
      fi
    fi
    if [[ $max == -1 ]]; then
      max=$actual
    else
      if [[ $max -lt $actual ]]; then
        max=$actual
      fi
    fi
    count=$((count + 1))
  done
  lineCounter=$((lineCounter+1))
  if [[ $count == 0 ]]; then
    echo "No values collected. " >> $sumupFile
  else
    avg=$((sum / count))
    echo "min: $min" >> $sumupFile
    echo "max: $max" >> $sumupFile
    echo "avg: $avg" >> $sumupFile  
  fi
done

END_TIME=$(date +%s)
TEST_DURATION=$((END_TIME-TIMESTAMP))
echo "Tests are done! :) "
echo "Tests lasted $TEST_DURATION seconds."
echo "You can see load tests sum up here: $sumupFile"
