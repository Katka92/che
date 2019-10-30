#!/bin/bash
set -e

# set constants
TIMESTAMP=$(date +%s)
TEST_FOLDER=$(pwd)

function printHelp {
  YELLOW="\\033[93;1m"
  WHITE="\\033[0;1m"
  GREEN="\\033[32;1m"
  NC="\\033[0m" # No Color
  
  echo -e "${YELLOW}$(basename "$0") ${WHITE}[-u <username>] [-n <number-of-users>] [-p <passwd>] [-r <url>] [-f <folder>]" 
  echo -e "\n${NC}Script for running load tests against Che 7."
  echo -e "${GREEN}where:${WHITE}"
  echo -e "-u    username"
  echo -e "-p    password"
  echo -e "-n    number of users ${NC} usernames will be set in format <username>1, <username>2, ..."${WHITE}
  echo -e "-m    number of users per pod"
  echo -e "-r    URL of Che"
  echo -e "-f    full path to folder ${NC} all reports will be saved in this folder"
}

while getopts "hu:p:r:n:f:" opt; do 
  case $opt in
    h) printHelp
      exit 0
      ;;
    u) export USERNAME=$OPTARG
      ;;
    p) export PASSWORD=$OPTARG
      ;;
    r) export URL=$OPTARG
      ;;
    n) export USER_COUNT=$OPTARG
      ;;
    f) export FOLDER=$OPTARG
      ;;
    \?)
      echo "\"$opt\" is an invalid option!"
      exit 1
      ;;
    :)
      echo "Option \"$opt\" needs an argument."
      exit 1
      ;;
  esac
done

function exists {
  resource=$1
  name=$2
  if ( oc get $1 $2 > /dev/null 2>&1 ); then
    return 0
  else 
    return 1
  fi
}

# check that all parameters are set
if [ -z $USERNAME ] || [ -z $PASSWORD ] || [ -z $URL ] || [ -z $USER_COUNT ] || [ -z $FOLDER ]; then
  echo "Some parameters are not set! Exitting load tests." 
  printHelp
  exit 1
else
  echo "Running load tests, result will be stored in $FOLDER in $TIMESTAMP subfolder."
fi

# ----------- PREPARE ENVIRONMENT ----------- #
# create pvc
clean_pvc=false
if ( exists pvc load-test-pvc ); then
  echo "PVC load-test-pvc already exists. Reusing and cleaning PVC."
  clean_pvc=true
else
  oc create -f pvc.yaml
fi

# create ftp server
if ( exists pod ftp-server ); then
  echo "Pod ftp-server already exists. Skipping creation."
else
  oc create -f ftp-server.yaml
fi

if ( exists service load-tests-ftp-service ); then
  echo "Service load-tests-ftp-service already exists. Skipping creation."
else
  oc create -f ftp-service.yaml
fi

if [[ $clean_pvc == true ]]; then
  while [ true ] 
  do
    status=$(oc get pod ftp-server | awk '{print $3}' | tail -n 1)
    if [[ $status == "Running" ]]; then
      oc exec ftp-server -it -- rm -rf /home/vsftpd/user/*
      break
    fi
  done
fi

# ----------- RUNNING TEST ----------- #

echo "-- Running pods with tests."

echo "Searching for already created jobs..."
jobs=$(oc get jobs -l group=load-tests)
if [[ ! -z $jobs ]]; then
  echo "[WARNING] There are some jobs already running. Removing all jobs with label \"load-tests\" and creating new one."
  oc delete jobs -l group=load-tests
  oc delete pods -l group=load-tests
fi

# set and create pods
cp pod.yaml template.yaml
parsed_url=$(echo $URL | sed 's/\//\\\//g')

sed -i "s/REPLACE_URL/\"$parsed_url\"/g" template.yaml
sed -i "s/REPLACE_PASSWORD/$PASSWORD/g" template.yaml
sed -i "s/REPLACE_TIMESTAMP/\"$TIMESTAMP\"/g" template.yaml

users_assigned=0
while [ $users_assigned -lt $USER_COUNT ] 
do
  users_assigned=$((users_assigned+1))
  cp template.yaml final.yaml
  sed -i "s/REPLACE_NAME/load-test-$users_assigned/g" final.yaml
  sed -i "s/REPLACE_USERNAME/$USERNAME$users_assigned/g" final.yaml
  oc create -f final.yaml
done

# wait for all pods to be Completed
echo "-- Waiting for all pods to be completed."
someNotRunning=true
while [ $someNotRunning == true ]
do
  someNotRunning=false
  for p in $(oc get pods -l group=load-tests -o name)
  do
    status=$(oc get $p | awk '{print $3}' | tail -n 1)
    if [[ $status != "Running" ]]; then
      someNotRunning=true;
      echo "Pods are not in state Running. Waiting for 10 seconds."
      sleep 10
      break
    fi
  done
done

echo "All pods are running, waiting for them to finish."
starting=$(date +%s)
someIsRunning=true
while [ $someIsRunning == true ]
do
  someIsRunning=false
  statuses=$(oc get pods -l group=load-tests -o jsonpath="{.items[*].status.phase}")
  if [[ $statuses == *"Running"* ]]; then
    someIsRunning=true;
    echo "Pods are still running. Waiting for 10 seconds."
    sleep 10
  fi
done
ending=$(date +%s)

echo "All pods are finished!"
statuses=""
for p in $(oc get pods -l group=load-tests -o name)
do
  status=$(oc get $p | awk '{print $3}' | tail -n 1)
  statuses="$statuses $status"
done
echo "Pods ended with those statuses: $statuses"

# ----------- GATHERING LOGS ----------- #

echo "-- Gathering logs."
# gather logs from PVC 
#oc create -f report.yaml
echo "Syncing files from PVC to local folder."

mkdir $FOLDER/$TIMESTAMP
cd $FOLDER/$TIMESTAMP
oc rsync --no-perms --include "user*/" ftp-server:/home/vsftpd/user/ $FOLDER/$TIMESTAMP
echo "Tar files rsynced, untarring..."
tar xf *.tar
rm *.tar
cd ..

# gather logs from pods
echo "Gathering logs from pods."
for p in $(oc get pods -l group=load-tests -o name)
do
  IFS='-'
  read -a strarr <<< "$p"
  unset IFS
  number=${strarr[2]}
  path_to_logs="$FOLDER/$TIMESTAMP"
  file="$path_to_logs/pod-$number-console-logs.txt"
  touch $file
  oc logs $p > $file
done

# ----------- CLEANING ENVIRONMENT ----------- #
echo "-- Cleaning environment."

oc delete jobs -l group=load-tests
oc delete pods -l group=load-tests

oc delete pod ftp-server
oc delete service load-tests-ftp-service
oc delete pvc load-test-pvc


# ----------- PROCESSING TEST RESULTS ----------- #
$TEST_FOLDER/process-logs.sh $TIMESTAMP $FOLDER $USER_COUNT $USERNAME
