echo "Ensure we exit on error"
set -e

# we can build android on both ubuntu and OSX
# should try both since there may be subtle differences
PLATFORM=`uname -a`

# both of these have java on Github Actions
# but may not in docker, for example
# should check for the existence of java and die if it doesn't exist
echo "Checking for java in the path"
JAVA_VERSION=`javac -version`
echo "Found java in the path with version $JAVA_VERSION"

echo "Setting up SDK environment"
MIN_SDK_VERSION=21
TARGET_SDK_VERSION=28

# Setup the development environment
source setup/setup_shared.sh

if [ -z $ANDROID_HOME ] && [ -z $ANDROID_SDK_ROOT ];
then
    echo "ANDROID_HOME and ANDROID_SDK_ROOT not set, android SDK not found, exiting"
    exit 1
else
    echo "ANDROID_HOME = $ANDROID_HOME; ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
fi

source setup/setup_shared_native.sh
